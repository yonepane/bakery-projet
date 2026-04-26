"""Main FastAPI application for BakeryOS.

This file owns the business workflows of the project: auth, inventory,
production, POS, purchasing, analytics, PDF exports, and the production
fallback that serves the frontend build.
"""

import csv
import json
import os
import sys
import uuid
from datetime import datetime, timedelta
from io import BytesIO, StringIO
from typing import Dict, List, Optional

import jwt
import sqlalchemy.orm
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from passlib.context import CryptContext
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import text

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

try:
    from . import models
    from .database import Base, SessionLocal, engine, get_db
except ImportError:
    import models
    from database import Base, SessionLocal, engine, get_db

VERCEL_ENV = os.getenv("VERCEL_ENV", "").lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_LOCAL_DEV = VERCEL_ENV in ("", "development") and ENVIRONMENT == "development"

# In production, the app must receive a real secret key from the environment.
# During local development, we allow a fallback value so the app can still
# start on a new machine.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set")

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def init_db():
    """Create tables and run lightweight schema self-healing on startup."""
    try:
        models.Base.metadata.create_all(bind=engine)
        ensure_runtime_schema()
        print("SaaS Database: Tables confirmed.")
    except Exception as e:
        print(f"DATABASE FATAL ERROR: {e}")
        if not IS_LOCAL_DEV:
            raise e

def ensure_runtime_schema():
    """Patch older databases that may still be missing newer PO fields."""
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            po_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(purchase_orders)"))}
            if "notes" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN notes VARCHAR"))
            if "expected_delivery_date" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date DATETIME"))
            return

        if engine.dialect.name == "postgresql":
            po_columns = {
                row[0]
                for row in conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'purchase_orders'
                        """
                    )
                )
            }
            if "notes" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN notes VARCHAR"))
            if "expected_delivery_date" not in po_columns:
                conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date TIMESTAMP"))

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    # Create a login token that the frontend can send back with later requests.
    to_encode = data.copy()
    from datetime import timezone
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    request: Request, 
    db: sqlalchemy.orm.Session = Depends(get_db)
):
    # First, try to read the token from the URL query string. This is useful
    # for cases such as opening a file download in a new browser tab.
    token = request.query_params.get("token")
    
    # If there was no token in the URL, try the normal Authorization header.
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_effective_owner_id(current_user: models.User = Depends(get_current_user)):
    # If the current user is a cashier, return the owner's ID instead of the
    # cashier's own ID. This keeps all bakery data grouped under the owner.
    if current_user.role == "owner":
        return current_user.id
    return current_user.parent_owner_id

def requires_roles(roles: List[str]):
    # Build a reusable permission check for routes that are only allowed for
    # certain roles, such as owner-only actions.
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Role {current_user.role} is not authorized for this action. Required: {roles}"
            )
        return current_user
    return role_checker


def _pdf_response(buffer: BytesIO, filename: str) -> Response:
    # Return a PDF file response in one shared helper, so the report routes do
    # not have to repeat the same response code.
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _format_money(value: float, currency: str) -> str:
    return f"{value:,.2f} {currency}"


def _report_styles():
    # Define the text styles used by the PDF reports and receipts.
    styles = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "BakeryEyebrow",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#8f8f93"),
            alignment=TA_LEFT,
        ),
        "logo": ParagraphStyle(
            "BakeryLogo",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#111111"),
        ),
        "title": ParagraphStyle(
            "BakeryTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=32,
            textColor=colors.HexColor("#111111"),
        ),
        "subtitle": ParagraphStyle(
            "BakerySubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#6b7280"),
        ),
        "card_label": ParagraphStyle(
            "BakeryCardLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#8f8f93"),
        ),
        "card_value": ParagraphStyle(
            "BakeryCardValue",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#111111"),
        ),
        "card_value_inverse": ParagraphStyle(
            "BakeryCardValueInverse",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.white,
        ),
        "body": ParagraphStyle(
            "BakeryBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#3f3f46"),
        ),
        "body_right": ParagraphStyle(
            "BakeryBodyRight",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#3f3f46"),
        ),
        "footer": ParagraphStyle(
            "BakeryFooter",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#a1a1aa"),
        ),
        "receipt_header": ParagraphStyle(
            "BakeryReceiptHeader",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=20,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111111"),
        ),
        "receipt_meta": ParagraphStyle(
            "BakeryReceiptMeta",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#52525b"),
        ),
        "receipt_body": ParagraphStyle(
            "BakeryReceiptBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#18181b"),
        ),
        "receipt_body_right": ParagraphStyle(
            "BakeryReceiptBodyRight",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#18181b"),
        ),
    }


def _receipt_page_size_mm(tx, paper: str) -> tuple[float, float]:
    paper_width = 58 if paper == "58mm" else 80
    item_count = len(tx.items or [])
    # Thermal receipts need enough paper height for all line items.
    # If the page is too short, the receipt can spill onto a second page.
    paper_height = max(125, 96 + (item_count * 18))
    return paper_width, paper_height


def _build_receipt_pdf(tx, currency: str, paper: str = "80mm") -> BytesIO:
    # Build the PDF for one sale receipt.
    styles = _report_styles()
    buffer = BytesIO()
    page_width_mm, page_height_mm = _receipt_page_size_mm(tx, paper)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=(page_width_mm * mm, page_height_mm * mm),
        leftMargin=6 * mm,
        rightMargin=6 * mm,
        topMargin=7 * mm,
        bottomMargin=6 * mm,
        title=f"Receipt {tx.id}",
    )

    story = [
        Paragraph("BAKERY OS", styles["receipt_header"]),
        Spacer(1, 2 * mm),
        Paragraph("Luxe Boulangerie Patisserie", styles["receipt_meta"]),
        Spacer(1, 3 * mm),
        HRFlowable(width="100%", thickness=1, color=colors.black, dash=[3, 2]),
        Spacer(1, 3 * mm),
        Paragraph(f"ID: {tx.id}", styles["receipt_meta"]),
        Paragraph(tx.timestamp.strftime("%Y-%m-%d %H:%M:%S"), styles["receipt_meta"]),
        Spacer(1, 3 * mm),
        HRFlowable(width="100%", thickness=1, color=colors.black, dash=[3, 2]),
        Spacer(1, 4 * mm),
    ]

    line_rows = [["Item", "Total"]]
    if tx.items:
        for item in tx.items:
            qty = item.get("qty", 1)
            name = item.get("name", "Product")
            price = float(item.get("price", 0))
            line_rows.append([
                Paragraph(f"{name}<br/><font size='8' color='#71717a'>x{qty} @ {price:.2f} {currency}</font>", styles["receipt_body"]),
                Paragraph(_format_money(round(price * qty, 2), currency), styles["receipt_body_right"]),
            ])
    else:
        line_rows.append([
            Paragraph("No line items recorded", styles["receipt_body"]),
            Paragraph("-", styles["receipt_body_right"]),
        ])

    content_width = page_width_mm - 12
    items_table = Table(line_rows, colWidths=[content_width * 0.64 * mm, content_width * 0.36 * mm], hAlign="LEFT")
    items_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#71717a")),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#d4d4d8")),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.extend([items_table, Spacer(1, 4 * mm)])

    total_table = Table(
        [[
            Paragraph("TOTAL", styles["receipt_body"]),
            Paragraph(_format_money(round(tx.total_revenue, 2), currency), styles["receipt_body_right"]),
        ]],
        colWidths=[content_width * 0.4 * mm, content_width * 0.6 * mm],
        hAlign="LEFT",
    )
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#111111")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.extend([
        total_table,
        Spacer(1, 4 * mm),
        Paragraph("THANK YOU FOR YOUR VISIT!", styles["receipt_meta"]),
        Paragraph("Merci de votre visite!", styles["receipt_meta"]),
        Spacer(1, 2 * mm),
        Paragraph("www.bakeryos.app", styles["footer"]),
    ])

    doc.build(story)
    buffer.seek(0)
    return buffer


def _build_monthly_report_pdf(
    *,
    start_date: datetime,
    transactions,
    expenses,
    waste_records,
    total_revenue: float,
    total_cogs: float,
    total_waste: float,
    total_overhead: float,
    net_profit: float,
    margin: float,
    currency: str,
) -> BytesIO:
    # Build the monthly accounting report PDF shown in the reporting screens.
    styles = _report_styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title=f"Monthly Report {start_date.strftime('%B %Y')}",
    )

    sales_count = len([t for t in transactions if t.type == "sale"])
    summary_cards = [
        ("Total Revenue", _format_money(total_revenue, currency), colors.HexColor("#111111"), colors.white),
        ("Net Profit", _format_money(net_profit, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#10b981") if net_profit >= 0 else colors.HexColor("#f43f5e")),
        ("Cost of Goods", _format_money(total_cogs, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#111111")),
        ("Waste Loss", _format_money(total_waste, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#f43f5e")),
        ("Fixed Overhead", _format_money(total_overhead, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#f43f5e")),
        ("Operating Margin", f"{margin:.1f}%", colors.HexColor("#111111"), colors.HexColor("#d4af37")),
    ]

    story = [
        Table(
            [[
                Paragraph("Bakery<font color='#d4af37'>OS</font>", styles["logo"]),
                Paragraph(
                    f"<para align='right'><b>Executive Financial Summary</b><br/><font color='#6b7280'>Period: {start_date.strftime('%B %Y')}</font></para>",
                    styles["body"],
                ),
            ]],
            colWidths=[90 * mm, 72 * mm],
        ),
        Spacer(1, 8 * mm),
        Paragraph("Financial Performance", styles["title"]),
        Spacer(1, 2 * mm),
        Paragraph(
            "This report summarizes the operational efficiency and net profitability for the selected period.",
            styles["subtitle"],
        ),
        Spacer(1, 8 * mm),
    ]

    card_rows = []
    for index in range(0, len(summary_cards), 2):
        row = []
        for label, value, bg, value_color in summary_cards[index:index + 2]:
            label_style = styles["card_label"]
            value_style = styles["card_value"] if bg != colors.HexColor("#111111") else styles["card_value_inverse"]
            if bg != colors.HexColor("#111111"):
                value_style = ParagraphStyle(
                    f"{value_style.name}-{label}",
                    parent=value_style,
                    textColor=value_color,
                )
            row.append(
                Table(
                    [[Paragraph(label.upper(), label_style)], [Paragraph(value, value_style)]],
                    colWidths=[78 * mm],
                )
            )
        if len(row) < 2:
            row.append("")
        card_rows.append(row)

    cards_table = Table(card_rows, colWidths=[82 * mm, 82 * mm], rowHeights=[26 * mm] * len(card_rows), hAlign="LEFT")
    cards_style = TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ])
    card_index = 0
    for row_index, row in enumerate(card_rows):
        for col_index, _ in enumerate(row):
            if card_index >= len(summary_cards):
                continue
            _, _, bg, _ = summary_cards[card_index]
            cards_style.add("BACKGROUND", (col_index, row_index), (col_index, row_index), bg)
            cards_style.add("BOX", (col_index, row_index), (col_index, row_index), 0.75, colors.HexColor("#ececec") if bg != colors.HexColor("#111111") else bg)
            cards_style.add("ROUNDEDCORNERS", (col_index, row_index), (col_index, row_index), 10)
            cards_style.add("LEFTPADDING", (col_index, row_index), (col_index, row_index), 10)
            cards_style.add("RIGHTPADDING", (col_index, row_index), (col_index, row_index), 10)
            cards_style.add("TOPPADDING", (col_index, row_index), (col_index, row_index), 10)
            cards_style.add("BOTTOMPADDING", (col_index, row_index), (col_index, row_index), 8)
            card_index += 1
    cards_table.setStyle(cards_style)
    story.extend([cards_table, Spacer(1, 10 * mm)])

    story.extend([
        Paragraph("Revenue Breakdown", ParagraphStyle("SectionHeading", parent=styles["body"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=colors.HexColor("#111111"))),
        Spacer(1, 3 * mm),
    ])

    breakdown_rows = [
        [
            Paragraph("<b>Category</b>", styles["body"]),
            Paragraph("<b>Transactions</b>", styles["body"]),
            Paragraph("<b>Amount</b>", styles["body_right"]),
        ],
        [
            Paragraph("Direct Sales", styles["body"]),
            Paragraph(str(sales_count), styles["body"]),
            Paragraph(_format_money(total_revenue, currency), styles["body_right"]),
        ],
        [
            Paragraph("Fixed Expenses", styles["body"]),
            Paragraph(str(len(expenses)), styles["body"]),
            Paragraph(f"-{_format_money(total_overhead, currency)}", styles["body_right"]),
        ],
        [
            Paragraph("Waste Deductions", styles["body"]),
            Paragraph(str(len(waste_records)), styles["body"]),
            Paragraph(f"-{_format_money(total_waste, currency)}", styles["body_right"]),
        ],
    ]
    breakdown_table = Table(breakdown_rows, colWidths=[82 * mm, 35 * mm, 45 * mm], hAlign="LEFT")
    breakdown_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8f9fa")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#e5e7eb")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#eeeeee")),
    ]))
    story.extend([
        breakdown_table,
        Spacer(1, 18 * mm),
        Paragraph(
            f"Generated by BakeryOS Intel-Engine | {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            styles["footer"],
        ),
    ])

    doc.build(story)
    buffer.seek(0)
    return buffer

app = FastAPI(title="BakeryOS API")
handler = app

# Vercel can receive a request before normal startup hooks finish.
# To avoid "missing table" problems, initialize the database during import too.
init_db()

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/api/init")
async def force_init():
    try:
        init_db()
        return {"status": "Database initialization successful", "version": "3.3"}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

# Allow the frontend running on local development ports to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "dist")

# These classes describe the shape of incoming JSON data.
# FastAPI uses them to validate requests automatically.
class IngredientItem(BaseModel):
    name: str
    quantity: float

class ProductionBatch(BaseModel):
    product_id: str
    quantity: int

class SaleItem(BaseModel):
    id: str
    qty: int

class SaleRequest(BaseModel):
    cart: List[SaleItem]

class MaterialCreate(BaseModel):
    name: str
    price: float
    unit: str
    min_threshold: float

class SupplierCreate(BaseModel):
    name: str
    contact_info: Optional[str] = None

class POReceiveItem(BaseModel):
    name: str
    qty: float
    price: Optional[float] = None

class POReceive(BaseModel):
    items: List[POReceiveItem]

class SettingsUpdate(BaseModel):
    updates: Dict[str, str]

class POCreate(BaseModel):
    supplier_id: int
    items: List[Dict]
    notes: Optional[str] = None
    expected_delivery_date: Optional[str] = None

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: Optional[str] = None

class StockAdjust(BaseModel):
    item_type: str # 'product' or 'material'
    id: str
    amount: float
    reason: Optional[str] = "Manual Adjustment"

class ProductCreate(BaseModel):
    id: str
    name: str
    price: float
    icon: str
    ingredients: List[IngredientItem]
    prep_time: Optional[int] = 0
    cook_time: Optional[int] = 0
    yield_qty: Optional[int] = 1
    instructions: Optional[List[str]] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    icon: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    yield_qty: Optional[int] = None
    instructions: Optional[List[str]] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    items: List[SaleItem]
    deposit_paid: float = 0
    pickup_date: str

class WasteCreate(BaseModel):
    product_id: str
    quantity: int

# These helper functions keep the route handlers shorter and easier to read.
def calculate_product_cost(product: models.Product):
    total_cost = 0
    for item in product.recipe_items:
        if item.ingredient:
            total_cost += item.quantity * item.ingredient.price
    return total_cost

def get_settings():
    # Settings are currently stored in a small JSON file because they are tiny
    # and mostly global. This could move into the database later if needed.
    settings_path = os.path.join(DATA_DIR, 'settings.json')
    if os.path.exists(settings_path):
        with open(settings_path, 'r') as f:
            return json.load(f)
    return {"currency": "MAD", "tax_rate": 0.2}

# This is a small development shortcut route.
@app.get("/api/seed", dependencies=[Depends(requires_roles(["owner"]))])
async def seed_users(
    db: sqlalchemy.orm.Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        # Only use this route as a development helper for an owner account.
        cashier = db.query(models.User).filter(
            models.User.username == "cashier",
            models.User.parent_owner_id == current_user.id
        ).first()
        if not cashier:
            db.add(models.User(
                username=f"cashier-{current_user.id}",
                password=get_password_hash("password"),
                role="cashier",
                parent_owner_id=current_user.id
            ))
            db.commit()
            
        return {"message": "Seed complete for current owner."}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "183197193874-qhf5nd87o77oo86jhksat53ncq3ahjp8.apps.googleusercontent.com",
)

# ... rest of your imports ...

class GoogleLoginRequest(BaseModel):
    credential: str

# This route is used when the user clicks "Sign in with Google" on the frontend.
# The frontend sends Google a login request first, then Google sends back a
# credential token. We verify that token here and then map the Google account
# to one of our own users in the BakeryOS database.
@app.post("/api/auth/google")
async def google_login(req: GoogleLoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
    try:
        # Step 1:
        # Ask Google if the credential token is real and was issued for our app.
        # If the token is fake, expired, or belongs to another app, this call
        # will fail and we stop the login.
        idinfo = id_token.verify_oauth2_token(req.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
        
        # Step 2:
        # Read the user's email from Google's response. In this project, the
        # email is used as the BakeryOS username for Google-based accounts.
        email = idinfo['email']
        
        # Step 3:
        # Look in our database to see whether this Google user already has a
        # BakeryOS account.
        user = db.query(models.User).filter(models.User.username == email).first()
        if not user:
            # If the user does not exist yet, create a brand-new owner account.
            # We still store something in the password field because the
            # database model requires one, but Google users are expected to log
            # in through Google rather than by typing this placeholder value.
            user = models.User(
                username=email, 
                password=get_password_hash("google_oauth_protected"), 
                role="owner",
                parent_owner_id=None
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # If the user already exists, make sure their role is "owner".
            # In this app, a Google account is always treated as the main
            # bakery owner account, not as a cashier account.
            if user.role != "owner":
                user.role = "owner"
                db.commit()
            
        # Step 4:
        # Create our own BakeryOS access token. From this point on, the frontend
        # uses this token to call protected API routes in our backend.
        access_token = create_access_token(data={"sub": user.username})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "username": user.username,
            "role": user.role
        }
    except Exception as e:
        print(f"Google Auth Error: {e}")
        raise HTTPException(status_code=400, detail="Google authentication failed")

@app.post("/api/auth/signup")
async def signup(req: LoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
    # First, make sure the username is not already taken by another account.
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # If the username is free, create a new owner account.
    new_user = models.User(
        username=req.username,
        password=get_password_hash(req.password),
        role="owner"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Bakery registered successfully. You can now log in."}

@app.post("/api/auth/login", response_model=Token)
async def login(req: LoginRequest, db: sqlalchemy.orm.Session = Depends(get_db)):
    # Find the user by username in our database.
    user = db.query(models.User).filter(models.User.username == req.username).first()

    # If the user does not exist, or the password is wrong, reject the login.
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # If the credentials are correct, create an access token for the frontend.
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "username": user.username,
        "role": user.role
    }

# The routes below let an owner create and manage cashier accounts.
@app.get("/api/staff", dependencies=[Depends(requires_roles(["owner"]))])
async def get_staff(db: sqlalchemy.orm.Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.User).filter(models.User.parent_owner_id == current_user.id).all()

class StaffCreate(BaseModel):
    username: str
    password: str

@app.post("/api/staff", dependencies=[Depends(requires_roles(["owner"]))])
async def create_staff(req: StaffCreate, db: sqlalchemy.orm.Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = models.User(
        username=req.username,
        password=get_password_hash(req.password),
        role="cashier",
        parent_owner_id=current_user.id
    )
    db.add(new_user)
    db.commit()
    return {"success": True}

@app.delete("/api/staff/{username}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_staff(username: str, db: sqlalchemy.orm.Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(
        models.User.username == username,
        models.User.parent_owner_id == current_user.id
    ).first()
    if user:
        db.delete(user)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Staff member not found")
# Orders are used for future pickup jobs, not same-day cash register sales.
@app.get("/api/orders")
async def get_orders(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    return db.query(models.Order).filter(models.Order.owner_id == owner_id).order_by(models.Order.pickup_date.asc()).all()

@app.post("/api/orders")
async def create_order(order_data: OrderCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    total_price = 0
    items_snapshot = []
    
    for item in order_data.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.id,
            models.Product.owner_id == owner_id
        ).first()
        if product:
            total_price += product.price * item.qty
            items_snapshot.append({
                "id": product.id,
                "name": product.name,
                "qty": item.qty,
                "price": product.price
            })
            
    new_order = models.Order(
        id=str(uuid.uuid4())[:8].upper(),
        owner_id=owner_id,
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        items=items_snapshot,
        total_price=total_price,
        deposit_paid=order_data.deposit_paid,
        pickup_date=datetime.fromisoformat(order_data.pickup_date),
        status="pending"
    )
    db.add(new_order)
    db.commit()
    return new_order

@app.patch("/api/orders/{id}/status")
async def update_order_status(id: str, status: str, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    order = db.query(models.Order).filter(
        models.Order.id == id,
        models.Order.owner_id == owner_id
    ).first()
    if order:
        order.status = status
        db.commit()
        return order
    raise HTTPException(status_code=404, detail="Order not found")

# Waste routes record stock that was lost, spoiled, or thrown away.
@app.post("/api/waste")
async def record_waste(waste: WasteCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    product = db.query(models.Product).filter(
        models.Product.id == waste.product_id,
        models.Product.owner_id == owner_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if product.stock < waste.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock to waste")
        
    product.stock -= waste.quantity
    # Use the recipe cost so the waste value matches the real production loss.
    loss_cost = calculate_product_cost(product) * waste.quantity
    
    record = models.WasteRecord(
        owner_id=owner_id,
        product_id=waste.product_id,
        quantity=waste.quantity,
        loss_cost=loss_cost
    )
    db.add(record)
    db.commit()
    return {"success": True}

@app.get("/api/waste", dependencies=[Depends(requires_roles(["owner"]))])
async def get_waste(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    records = db.query(models.WasteRecord).filter(
        models.WasteRecord.owner_id == owner_id
    ).order_by(models.WasteRecord.date.desc()).all()
    return [
        {
            "id": record.id,
            "date": record.date.isoformat(),
            "product_id": record.product_id,
            "product_name": record.product.name if record.product else "Unknown",
            "quantity": record.quantity,
            "loss_cost": record.loss_cost,
        }
        for record in records
    ]

# Return inventory in a shape that the frontend can use directly, without
# extra joining work in the browser.
@app.get("/api/inventory")
async def inventory(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    
    # Build the materials object in the format expected by the current React UI.
    materials_dict = {
        ing.name: {
            "id": ing.id,
            "stock": ing.stock,
            "unit": ing.unit,
            "price": ing.price,
            "min_threshold": ing.min_threshold
        } for ing in ingredients
    }
    
    products_list = []
    for p in products:
        products_list.append({
            "id": p.id,
            "name": p.name,
            "stock": p.stock,
            "price": p.price,
            "icon": p.icon,
            "prep_time": p.prep_time,
            "cook_time": p.cook_time,
            "yield_qty": p.yield_qty,
            "instructions": p.instructions or [],
            "live_cost": calculate_product_cost(p),
            "ingredients": [{"name": i.ingredient.name if i.ingredient else "Unknown", "quantity": i.quantity} for i in p.recipe_items]
        })
        
    return {
        "materials": materials_dict,
        "products": products_list
    }

@app.get("/api/planner/prep-sheet")
async def get_prep_sheet(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    pending = db.query(models.Planner).filter(
        models.Planner.owner_id == owner_id,
        models.Planner.status == 'pending'
    ).all()
    
    if not pending:
        return "<h1>No pending batches in planner.</h1>"

    # Merge all pending planner rows into one kitchen prep sheet.
    requirements = {}
    production_summary = []
    
    for item in pending:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.owner_id == owner_id
        ).first()
        if not product: continue
        
        production_summary.append({
            "name": product.name,
            "qty": item.quantity,
            "icon": product.icon
        })
        
        for recipe_item in product.recipe_items:
            name = recipe_item.ingredient.name if recipe_item.ingredient else "Unknown"
            qty = recipe_item.quantity * item.quantity
            unit = recipe_item.ingredient.unit if recipe_item.ingredient else "g"
            
            if name not in requirements:
                requirements[name] = {"qty": 0, "unit": unit}
            requirements[name]["qty"] += qty

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>BakeryOS - Master Prep Sheet</title>
        <style>
            body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1b; line-height: 1.6; }}
            .header {{ text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px; }}
            h1 {{ font-family: 'Playfair Display', serif; text-transform: uppercase; letter-spacing: 2px; margin: 0; }}
            .date {{ color: #888; font-size: 0.9em; margin-top: 5px; }}
            .section {{ margin-bottom: 40px; }}
            h2 {{ font-size: 1.2em; text-transform: uppercase; border-left: 4px solid #D4AF37; padding-left: 15px; margin-bottom: 20px; }}
            table {{ w-full; border-collapse: collapse; margin-top: 10px; width: 100%; }}
            th, td {{ text-align: left; padding: 12px; border-bottom: 1px solid #eee; }}
            th {{ font-size: 0.8em; text-transform: uppercase; color: #888; }}
            .qty {{ font-weight: bold; font-family: monospace; font-size: 1.1em; }}
            .item-name {{ font-weight: 600; }}
            @media print {{
                .no-print {{ display: none; }}
                body {{ padding: 0; }}
            }}
            .print-btn {{ 
                background: #1a1a1b; color: white; border: none; padding: 10px 20px; border-radius: 8px; 
                cursor: pointer; font-weight: bold; margin-bottom: 20px;
            }}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
    </head>
    <body>
        <div class="no-print">
            <button class="print-btn" onclick="window.print()">Print Prep Sheet</button>
        </div>
        
        <div class="header">
            <h1>Master Prep List</h1>
            <div class="date">{datetime.now().strftime('%A, %d %B %Y | %H:%M')}</div>
        </div>

        <div class="section">
            <h2>Production Targets</h2>
            <table>
                <thead>
                    <tr><th>Entity</th><th>Target Quantity</th></tr>
                </thead>
                <tbody>
                    {''.join([f"<tr><td class='item-name'>{p['icon']} {p['name']}</td><td class='qty'>{p['qty']} units</td></tr>" for p in production_summary])}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Material Requirements (Consolidated)</h2>
            <table>
                <thead>
                    <tr><th>Ingredient</th><th>Total Needed</th><th>Measurement</th></tr>
                </thead>
                <tbody>
                    {''.join([f"<tr><td class='item-name'>{name}</td><td class='qty'>{round(data['qty'], 2)}</td><td>{data['unit']}</td></tr>" for name, data in requirements.items()])}
                </tbody>
            </table>
        </div>

        <div style="margin-top: 50px; text-align: center; color: #ccc; font-size: 0.8em; border-top: 1px solid #eee; padding-top: 20px;">
            BAKERYOS INTEL-ENGINE | OPERATIONAL PROTOCOL
        </div>
    </body>
    </html>
    """
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)

@app.get("/api/history")
async def get_history(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # Return a simple history list for the dashboard timeline.
    transactions = db.query(models.Transaction).filter(models.Transaction.owner_id == owner_id).order_by(models.Transaction.timestamp.desc()).all()
    return [
        {
            "id": tx.id,
            "timestamp": tx.timestamp.isoformat(),
            "type": tx.type,
            "revenue": tx.total_revenue,
            "cost": tx.total_cost,
            "profit": tx.total_revenue - tx.total_cost,
            "items": tx.items
        } for tx in transactions
    ]

@app.get("/api/planner")
async def get_planner(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    return db.query(models.Planner).filter(models.Planner.owner_id == owner_id).all()

@app.post("/api/planner")
async def update_planner(plan: List[Dict], db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # The frontend sends the full planner list at once.
    # Replace the old planner rows with the new list.
    db.query(models.Planner).filter(models.Planner.owner_id == owner_id).delete()
    for item in plan:
        new_item = models.Planner(
            id=item.get('id', str(uuid.uuid4())[:8].upper()),
            owner_id=owner_id,
            product_id=item['product_id'],
            date=item['date'],
            quantity=item['quantity'],
            status=item.get('status', 'pending')
        )
        db.add(new_item)
    db.commit()
    return {"success": True}

@app.get("/api/settings")
async def get_settings_api(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    settings = db.query(models.SystemSetting).filter(models.SystemSetting.owner_id == owner_id).all()
    return {s.key: s.value for s in settings}

@app.patch("/api/settings", dependencies=[Depends(requires_roles(["owner"]))])
async def update_settings(
    payload: SettingsUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    # Save each setting by updating it if it already exists, or creating it if
    # it does not exist yet.
    for key, value in payload.updates.items():
        setting = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key,
            models.SystemSetting.owner_id == owner_id
        ).first()
        if setting:
            setting.value = value
        else:
            db.add(models.SystemSetting(key=key, owner_id=owner_id, value=value))
    db.commit()
    return {"success": True}

@app.post("/api/produce")
async def produce(batch: ProductionBatch, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    product = db.query(models.Product).filter(
        models.Product.id == batch.product_id,
        models.Product.owner_id == owner_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    production_cost = 0
    # Producing a batch uses up ingredients and adds stock to the finished product.
    for item in product.recipe_items:
        ing = db.query(models.Ingredient).filter(
            models.Ingredient.id == item.ingredient_id,
            models.Ingredient.owner_id == owner_id
        ).first()
        required = item.quantity * batch.quantity
        if not ing or ing.stock < required:
            raise HTTPException(status_code=400, detail=f"Insufficient {item.ingredient.name if item.ingredient else 'Ingredient'}")
        ing.stock -= required
        production_cost += required * ing.price

    product.stock += batch.quantity

    # Save this production event as a transaction so it appears in history and analytics.
    tx_id = str(uuid.uuid4())[:8].upper()
    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.utcnow(),
        type="production",
        total_revenue=0,
        total_cost=production_cost,
        items=[{"name": product.name, "qty": batch.quantity}]
    )
    db.add(transaction)
    db.commit()

    return {"success": True, "new_stock": product.stock}
@app.post("/api/complete")
async def complete_sale(req: SaleRequest, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    total_revenue = 0
    total_cost = 0
    items_snapshot = []

    # Save a copy of the sold item details so old receipts stay correct even if
    # the product is edited later.
    for item in req.cart:
        product = db.query(models.Product).filter(
            models.Product.id == item.id,
            models.Product.owner_id == owner_id
        ).first()
        if not product: continue
        
        if product.stock < item.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
            
        product.stock -= item.qty
        cost = calculate_product_cost(product)
        
        total_revenue += product.price * item.qty
        total_cost += cost * item.qty
        items_snapshot.append({
            "id": product.id,
            "name": product.name,
            "qty": item.qty,
            "price": product.price,
            "cost": cost
        })

    tx_id = str(uuid.uuid4())[:8].upper()
    transaction = models.Transaction(
        id=tx_id,
        owner_id=owner_id,
        timestamp=datetime.utcnow(),
        type="sale",
        total_revenue=total_revenue,
        total_cost=total_cost,
        items=items_snapshot
    )
    
    db.add(transaction)
    db.commit()
    
    # Build a text version of the receipt that the frontend can share quickly.
    whatsapp_text = f"BAKERY OS: Receipt {tx_id}\n"
    for item in items_snapshot:
        whatsapp_text += f"- {item['name']} x{item['qty']}\n"
    whatsapp_text += f"\nTOTAL: {total_revenue} {get_settings().get('currency', 'MAD')}\nMerci de votre visite! 🥐"

    return {"success": True, "transaction_id": tx_id, "whatsapp_text": whatsapp_text}

@app.get("/api/transactions/{id}/receipt")
async def get_receipt(
    id: str,
    format: str = "pdf",
    paper: str = "80mm",
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Support both PDF and printable HTML so the app works with receipt
    # printers as well as normal browsers.
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == id,
        models.Transaction.owner_id == owner_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    settings = get_settings()
    currency = settings.get("currency", "MAD")
    normalized_paper = "58mm" if paper.lower() == "58mm" else "80mm"

    if format.lower() == "pdf":
        return _pdf_response(_build_receipt_pdf(tx, currency, normalized_paper), f"receipt-{tx.id}.pdf")
    
    html_content = f"""
    <html>
    <head>
        <title>Receipt - {tx.id}</title>
        <style>
            body {{ font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 4mm; border: 1px solid #eee; background: white; color: black; }}
            .center {{ text-align: center; }}
            .header {{ font-weight: bold; font-size: 20px; margin-bottom: 5px; }}
            .separator {{ border-bottom: 1px dashed #000; margin: 10px 0; }}
            .item {{ display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }}
            .total {{ font-weight: bold; display: flex; justify-content: space-between; margin-top: 10px; font-size: 16px; }}
            .footer {{ font-size: 12px; margin-top: 20px; color: #666; }}
            @media print {{
                @page {{ size: {normalized_paper} auto; margin: 0; }}
                body {{ border: none; padding: 0; width: {normalized_paper}; }}
                .no-print {{ display: none; }}
            }}
            .print-btn {{ background: #000; color: #fff; border: none; padding: 10px 20px; cursor: pointer; border-radius: 5px; margin-bottom: 20px; width: 100%; }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <button class="print-btn" onclick="window.print()">PRINT RECEIPT</button>
        </div>
        <div class="center">
            <div class="header">BAKERY OS</div>
            <div>Luxe Boulangerie Patisserie</div>
            <div class="separator"></div>
            <div>ID: {tx.id}</div>
            <div>{tx.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</div>
            <div class="separator"></div>
        </div>
        
        <div class="items">
    """
    
    if tx.items:
        for item in tx.items:
            html_content += f"""
            <div class="item">
                <span>{item.get('name', 'Product')} x{item.get('qty', 1)}</span>
                <span>{round(item.get('price', 0) * item.get('qty', 1), 2)} {currency}</span>
            </div>
            """
            
    html_content += f"""
        </div>
        <div class="separator"></div>
        <div class="total">
            <span>TOTAL</span>
            <span>{round(tx.total_revenue, 2)} {currency}</span>
        </div>
        <div class="separator"></div>
        <div class="center footer">
            THANK YOU FOR YOUR VISIT!<br>
            Merci de votre visite!<br>
            www.bakeryos.app
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@app.get("/api/analytics", dependencies=[Depends(requires_roles(["owner"]))])
async def analytics(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # Analytics includes both all-time totals and current-shift totals.
    # A new shift starts when the owner manually resets the session.
    transactions = db.query(models.Transaction).filter(models.Transaction.owner_id == owner_id).all()
    waste_records = db.query(models.WasteRecord).filter(models.WasteRecord.owner_id == owner_id).all()
    settings_data = get_settings() # We could also make this per-owner later
    
    # Read the last reset time from settings.
    reset_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "last_reset_at",
        models.SystemSetting.owner_id == owner_id
    ).first()
    
    if reset_setting:
        last_reset = datetime.fromisoformat(reset_setting.value)
    else:
        # If there is no reset time yet, treat the start of today as the reset point.
        now = datetime.now()
        last_reset = datetime(now.year, now.month, now.day)

    # Calculate totals using all saved history.
    total_revenue = sum(t.total_revenue for t in transactions if t.type == 'sale')
    total_cost = sum(t.total_cost for t in transactions) + sum(w.loss_cost for w in waste_records)
    
    # Calculate current-session totals using only data since the last reset.
    session_txs = [t for t in transactions if t.timestamp >= last_reset]
    session_waste = [w for w in waste_records if w.date >= last_reset]
    
    today_revenue = sum(t.total_revenue for t in session_txs if t.type == 'sale')
    today_cost = sum(t.total_cost for t in session_txs) + sum(w.loss_cost for w in session_waste)

    # Build the last 7 days of chart data.
    daily_data = []
    now = datetime.now()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime('%a')
        s_day = datetime(day.year, day.month, day.day)
        e_day = s_day + timedelta(days=1)
        
        day_txs = [t for t in transactions if t.timestamp >= s_day and t.timestamp < e_day]
        daily_data.append({
            "name": day_str,
            "revenue": sum(t.total_revenue for t in day_txs if t.type == 'sale'),
            "cost": sum(t.total_cost for t in day_txs)
        })

    # Group sales by hour for the hourly sales chart.
    hourly_sales = [{"hour": f"{h:02d}h", "value": 0} for h in range(24)]
    for tx in [t for t in transactions if t.type == 'sale']:
        hour = tx.timestamp.hour
        hourly_sales[hour]["value"] += tx.total_revenue
        
    # Count which products sold the most.
    product_stats = {}
    for tx in [t for t in transactions if t.type == 'sale']:
        if tx.items:
            for item in tx.items:
                name = item.get('name', 'Unknown')
                qty = item.get('qty', 0)
                product_stats[name] = product_stats.get(name, 0) + qty
                
    top_products = [
        {"name": name, "value": qty} 
        for name, qty in sorted(product_stats.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    # These summary numbers help the owner judge the product catalog as a whole.
    total_portfolio_cost = sum(calculate_product_cost(p) for p in db.query(models.Product).filter(models.Product.owner_id == owner_id).all())
    avg_margin = 0
    if top_products:
        margins = []
        for p in db.query(models.Product).filter(models.Product.owner_id == owner_id).all():
            cost = calculate_product_cost(p)
            if p.price > 0:
                margins.append((p.price - cost) / p.price * 100)
        avg_margin = sum(margins) / len(margins) if margins else 0

    return {
        "revenue": round(total_revenue, 2),
        "cost": round(total_cost, 2),
        "today_revenue": round(today_revenue, 2),
        "today_cost": round(today_cost, 2),
        "currency": settings_data.get("currency", "MAD"),
        "chartData": daily_data,
        "hourlySales": hourly_sales,
        "topProducts": top_products,
        "intelligence": {
            "total_portfolio_cost": round(total_portfolio_cost, 2),
            "average_margin": f"{round(avg_margin, 2)}%",
            "products_count": len(product_stats)
        }
    }

@app.get("/api/alerts")
async def get_alerts(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    
    alerts = []
    
    # Create alerts when ingredient stock gets low.
    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            alerts.append({
                "type": "stock",
                "severity": "high" if ing.stock < ing.min_threshold / 2 else "medium",
                "message": f"Low stock: {ing.name} ({ing.stock}{ing.unit})",
                "id": f"stock-{ing.name}"
            })
            
    # Create alerts when a product's profit margin looks too low.
    for p in products:
        cost = calculate_product_cost(p)
        margin = ((p.price - cost) / p.price * 100) if p.price > 0 else 0
        if margin < 30:
            alerts.append({
                "type": "margin",
                "severity": "medium",
                "message": f"Low margin on {p.name}: {round(margin, 1)}%",
                "id": f"margin-{p.id}"
            })
            
    return alerts

@app.get("/api/intelligence/profit-report", dependencies=[Depends(requires_roles(["owner"]))])
async def profit_report(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    report = []
    for p in products:
        cost = calculate_product_cost(p)
        profit = p.price - cost
        roi = (profit / cost * 100) if cost > 0 else 0
        report.append({
            "product_id": p.id,
            "product_name": p.name,
            "cost_price": round(cost, 2),
            "selling_price": round(p.price, 2),
            "net_profit": round(profit, 2),
            "roi_percentage": f"{round(roi, 2)}%",
            "margin_percentage": f"{round((profit / p.price * 100), 2) if p.price > 0 else 0}%"
        })
    return report

@app.post("/api/simulate_price", dependencies=[Depends(requires_roles(["owner"]))])
async def simulate_price(materials_update: Dict[str, float], db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # Simulate ingredient price changes without saving them to the database.
    impact = []
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()
    
    # Build a lookup table so each recipe line can use the new test price when
    # available, or the saved price otherwise.
    all_ingredients = {ing.name: ing for ing in db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()}
    
    for p in products:
        old_cost = calculate_product_cost(p)
        
        # Recalculate the product cost as if the new prices were already active.
        new_cost = 0
        for item in p.recipe_items:
            price = materials_update.get(item.ingredient.name if item.ingredient else "", 
                                         item.ingredient.price if item.ingredient else 0)
            new_cost += item.quantity * price
            
        impact.append({
            "name": p.name,
            "old_cost": round(old_cost, 2),
            "new_cost": round(new_cost, 2),
            "old_profit": round(p.price - old_cost, 2),
            "new_profit": round(p.price - new_cost, 2),
            "margin_impact": round(((p.price - new_cost) / p.price * 100) if p.price > 0 else 0, 2),
            "profit_delta": round((p.price - new_cost) - (p.price - old_cost), 2)
        })
    return impact

@app.post("/api/update_material_prices", dependencies=[Depends(requires_roles(["owner"]))])
async def update_material_prices(materials_update: Dict[str, float], db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    for name, new_price in materials_update.items():
        ing = db.query(models.Ingredient).filter(
            models.Ingredient.name == name,
            models.Ingredient.owner_id == owner_id
        ).first()
        if ing:
            ing.price = new_price
    db.commit()
    return {"success": True}

# The routes below create, update, and delete inventory data.
@app.post("/api/materials", dependencies=[Depends(requires_roles(["owner"]))])
async def add_material(mat: MaterialCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    existing = db.query(models.Ingredient).filter(
        models.Ingredient.name == mat.name,
        models.Ingredient.owner_id == owner_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material already exists")
    
    new_ing = models.Ingredient(
        name=mat.name,
        owner_id=owner_id,
        price=mat.price,
        unit=mat.unit,
        min_threshold=mat.min_threshold,
        stock=0
    )
    db.add(new_ing)
    db.commit()
    return {"success": True}

@app.put("/api/materials/{name}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_material(name: str, mat: MaterialCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    ing = db.query(models.Ingredient).filter(
        models.Ingredient.name == name,
        models.Ingredient.owner_id == owner_id
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Material not found")
    
    ing.name = mat.name
    ing.price = mat.price
    ing.unit = mat.unit
    ing.min_threshold = mat.min_threshold
    db.commit()
    return {"success": True}

@app.delete("/api/materials/{name}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_material(
    name: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    ing = db.query(models.Ingredient).filter(
        models.Ingredient.name == name,
        models.Ingredient.owner_id == owner_id
    ).first()
    if ing:
        db.delete(ing)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Material not found")

@app.post("/api/products", dependencies=[Depends(requires_roles(["owner"]))])
async def add_product(prod: ProductCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    if not prod.id.strip():
        raise HTTPException(status_code=400, detail="Product ID cannot be empty")
    
    existing = db.query(models.Product).filter(
        models.Product.id == prod.id,
        models.Product.owner_id == owner_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product ID already exists")
    
    new_prod = models.Product(
        id=prod.id,
        owner_id=owner_id,
        name=prod.name,
        price=prod.price,
        icon=prod.icon,
        prep_time=prod.prep_time,
        cook_time=prod.cook_time,
        yield_qty=prod.yield_qty,
        instructions=prod.instructions,
        stock=0
    )
    db.add(new_prod)
    db.flush()
    
    created_ingredients = []
    for ing_data in prod.ingredients:
        # If an ingredient does not exist yet, create it automatically so the
        # product can still be saved.
        ing = db.query(models.Ingredient).filter(
            models.Ingredient.name == ing_data.name,
            models.Ingredient.owner_id == owner_id
        ).first()
        if not ing:
            ing = models.Ingredient(
                name=ing_data.name,
                owner_id=owner_id,
                stock=0,
                unit="g",
                price=0,
                min_threshold=1000
            )
            db.add(ing)
            db.flush()
            created_ingredients.append(ing_data.name)

        recipe_item = models.RecipeItem(
            product_id=new_prod.id,
            ingredient_id=ing.id,
            quantity=ing_data.quantity
        )
        db.add(recipe_item)
        
    db.commit()
    return {
        "success": True, 
        "message": f"Product created. {len(created_ingredients)} new ingredients added to inventory with placeholder prices." if created_ingredients else "Product created successfully."
    }

@app.put("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_product(id: str, update: ProductUpdate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    product = db.query(models.Product).filter(
        models.Product.id == id,
        models.Product.owner_id == owner_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if update.name is not None: product.name = update.name
    if update.price is not None: product.price = update.price
    if update.icon is not None: product.icon = update.icon
    if update.prep_time is not None: product.prep_time = update.prep_time
    if update.cook_time is not None: product.cook_time = update.cook_time
    if update.yield_qty is not None: product.yield_qty = update.yield_qty
    if update.instructions is not None: product.instructions = update.instructions
    
    if update.ingredients is not None:
        # Delete the old recipe rows and rebuild them to match the edited list exactly.
        db.query(models.RecipeItem).filter(models.RecipeItem.product_id == id).delete()
        for ing_data in update.ingredients:
            ing = db.query(models.Ingredient).filter(
                models.Ingredient.name == ing_data.name,
                models.Ingredient.owner_id == owner_id
            ).first()
            if ing:
                db.add(models.RecipeItem(
                    product_id=id,
                    ingredient_id=ing.id,
                    quantity=ing_data.quantity
                ))
            
    db.commit()
    return {"success": True}

@app.delete("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_product(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    product = db.query(models.Product).filter(
        models.Product.id == id,
        models.Product.owner_id == owner_id
    ).first()
    if product:
        db.delete(product)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Product not found")

# These maintenance routes clean up broken rows created by older versions or
# interrupted save flows.
@app.post("/api/maintenance/delete-empty-products", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_empty_product(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Use direct SQL here because corrupted rows may be awkward to clean with the ORM.
    from sqlalchemy import text
    db.execute(
        text("DELETE FROM products WHERE owner_id = :owner_id AND (id = '' OR id IS NULL)"),
        {"owner_id": owner_id},
    )
    db.commit()
    return {"success": True, "deleted": "Done"}

@app.post("/api/maintenance/cleanup-products", dependencies=[Depends(requires_roles(["owner"]))])
async def cleanup_invalid_products(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Remove products that have an empty ID or empty name.
    invalid = db.query(models.Product).filter(
        models.Product.owner_id == owner_id,
        ((models.Product.id == '') | (models.Product.name == ''))
    ).all()
    count = len(invalid)
    for p in invalid:
        db.delete(p)
    db.commit()
    return {"success": True, "count": count}

import httpx

# These recipe import helpers use a built-in starter kit when the external API
# has no data or cannot be reached.
BAKERY_STARTER_KIT = [
    {
        "id": "starter-1",
        "name": "Classic Butter Croissant",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/vussuy1511882648.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Milk", "quantity": 200},
            {"name": "Sugar", "quantity": 50},
            {"name": "Yeast", "quantity": 10}
        ]
    },
    {
        "id": "starter-2",
        "name": "Pain au Chocolat",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Chocolate", "quantity": 100},
            {"name": "Milk", "quantity": 150}
        ]
    },
    {
        "id": "starter-3",
        "name": "Almond Macarons",
        "category": "Dessert",
        "thumb": "https://www.themealdb.com/images/media/meals/xvsurr1511719182.jpg",
        "ingredients": [
            {"name": "Almond Flour", "quantity": 200},
            {"name": "Sugar", "quantity": 200},
            {"name": "Eggs", "quantity": 3},
            {"name": "Vanilla", "quantity": 5}
        ]
    }
]

@app.get("/api/external-recipes/search")
async def search_external_recipes(query: str, current_user: models.User = Depends(get_current_user)):
    results = []
    
    # 1. Search the baked-in starter kit first so something useful appears even
    #    without network access.
    for recipe in BAKERY_STARTER_KIT:
        if query.lower() in recipe["name"].lower():
            results.append({
                "id": recipe["id"],
                "name": recipe["name"],
                "category": recipe["category"],
                "thumb": recipe["thumb"]
            })

    # 2. Enrich the list with results from TheMealDB when reachable.
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"https://www.themealdb.com/api/json/v1/1/search.php?s={query}"
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get("meals"):
                    for meal in data["meals"]:
                        # Avoid duplicates from the local starter-kit matches.
                        if not any(r["name"] == meal["strMeal"] for r in results):
                            results.append({
                                "id": meal["idMeal"],
                                "name": meal["strMeal"],
                                "category": meal["strCategory"],
                                "thumb": meal["strMealThumb"]
                            })
    except Exception as e:
        print(f"External API Error: {e}")
        # If the API fails and nothing matched locally, return the whole starter kit.
        if not results:
            for recipe in BAKERY_STARTER_KIT:
                results.append({
                    "id": recipe["id"],
                    "name": recipe["name"],
                    "category": recipe["category"],
                    "thumb": recipe["thumb"]
                })
    
    return results

@app.get("/api/external-recipes/{recipe_id}/details")
async def get_external_recipe_details(recipe_id: str, current_user: models.User = Depends(get_current_user)):
    # 1. Serve baked-in recipes instantly when the ID belongs to the starter kit.
    for recipe in BAKERY_STARTER_KIT:
        if recipe["id"] == recipe_id:
            return recipe

    # 2. Otherwise fetch and normalize the remote recipe shape.
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={recipe_id}"
            response = await client.get(url)
            data = response.json()
            
            if not data.get("meals"):
                raise HTTPException(status_code=404, detail="Recipe not found")
                
            meal = data["meals"][0]
            ingredients = []
            
            for i in range(1, 21):
                name = meal.get(f"strIngredient{i}")
                measure = meal.get(f"strMeasure{i}")
                
                if name and name.strip():
                    qty = 0
                    if measure:
                        import re
                        match = re.search(r"(\d+)", measure)
                        if match:
                            qty = float(match.group(1))
                    
                    ingredients.append({
                        "name": name.strip().title(),
                        "quantity": qty
                    })
            
            return {
                "name": meal["strMeal"],
                "ingredients": ingredients,
                "thumb": meal["strMealThumb"]
            }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")

# Small owner-only stock controls and purchasing workflow.
@app.post("/api/inventory/adjust", dependencies=[Depends(requires_roles(["owner"]))])
async def adjust_stock(
    adj: StockAdjust,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    if adj.item_type == 'product':
        item = db.query(models.Product).filter(
            models.Product.id == adj.id,
            models.Product.owner_id == owner_id
        ).first()
    else:
        item = db.query(models.Ingredient).filter(
            models.Ingredient.name == adj.id,
            models.Ingredient.owner_id == owner_id
        ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    item.stock += adj.amount
    db.commit()
    return {"success": True, "new_stock": item.stock}

@app.get("/api/purchasing/suggest", dependencies=[Depends(requires_roles(["owner"]))])
async def suggest_purchase(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # Suggest enough stock to get back above the safety threshold.
    ingredients = db.query(models.Ingredient).filter(models.Ingredient.owner_id == owner_id).all()
    suggestions = []
    for ing in ingredients:
        if ing.stock < ing.min_threshold:
            suggestions.append({
                "name": ing.name,
                "current_stock": ing.stock,
                "min_threshold": ing.min_threshold,
                "suggested_buy": ing.min_threshold * 2 - ing.stock,
                "unit": ing.unit,
                "estimated_cost": (ing.min_threshold * 2 - ing.stock) * ing.price
            })
    return suggestions

@app.get("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def get_suppliers(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    return db.query(models.Supplier).filter(models.Supplier.owner_id == owner_id).all()

@app.post("/api/suppliers", dependencies=[Depends(requires_roles(["owner"]))])
async def add_supplier(supp: SupplierCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    new_supp = models.Supplier(**supp.dict(), owner_id=owner_id)
    db.add(new_supp)
    db.commit()
    return {"success": True}

@app.put("/api/suppliers/{supplier_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_supplier(
    supplier_id: int,
    supp: SupplierCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.owner_id == owner_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.name = supp.name
    supplier.contact_info = supp.contact_info
    db.commit()
    return {"success": True}

@app.delete("/api/suppliers/{supplier_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_supplier(
    supplier_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.owner_id == owner_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    linked_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == supplier_id,
        models.PurchaseOrder.owner_id == owner_id
    ).count()
    if linked_orders:
        raise HTTPException(status_code=400, detail="Supplier has purchase order history")
    db.delete(supplier)
    db.commit()
    return {"success": True}

@app.get("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def get_pos(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    return db.query(models.PurchaseOrder).filter(models.PurchaseOrder.owner_id == owner_id).all()

@app.delete("/api/purchase-orders/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_po(id: str, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")
    po.archived = True
    db.commit()
    return {"success": True}

@app.post("/api/purchase-orders", dependencies=[Depends(requires_roles(["owner"]))])
async def create_po(po: POCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == po.supplier_id,
        models.Supplier.owner_id == owner_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    normalized_items = []
    for item in po.items:
        ordered_qty = float(item.get("qty", 0))
        normalized_items.append({
            "name": item.get("name"),
            "qty": ordered_qty,
            "price": float(item.get("price", 0)),
            "received_qty": float(item.get("received_qty", 0)),
        })

    new_po = models.PurchaseOrder(
        id=str(uuid.uuid4())[:8].upper(),
        owner_id=owner_id,
        supplier_id=po.supplier_id,
        items=normalized_items,
        notes=po.notes,
        expected_delivery_date=datetime.fromisoformat(po.expected_delivery_date) if po.expected_delivery_date else None,
        status="draft"
    )
    db.add(new_po)
    db.commit()
    return {"success": True}

@app.patch("/api/purchase-orders/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_po(
    id: str,
    po: POCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    existing = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    supplier = db.query(models.Supplier).filter(
        models.Supplier.id == po.supplier_id,
        models.Supplier.owner_id == owner_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    existing.supplier_id = po.supplier_id
    existing.notes = po.notes
    existing.expected_delivery_date = datetime.fromisoformat(po.expected_delivery_date) if po.expected_delivery_date else None
    existing.items = [
        {
            "name": item.get("name"),
            "qty": float(item.get("qty", 0)),
            "price": float(item.get("price", 0)),
            "received_qty": float(item.get("received_qty", 0)),
        }
        for item in po.items
    ]
    db.commit()
    return {"success": True}

@app.post("/api/purchase-orders/{id}/receive", dependencies=[Depends(requires_roles(["owner"]))])
async def receive_po(
    id: str,
    payload: POReceive,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    # Partial receiving lets the bakery update stock even when a supplier ships
    # only part of the order.
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")

    items_by_name = {item["name"]: item for item in po.items}
    for received in payload.items:
        item = items_by_name.get(received.name)
        if not item:
            continue
        ordered_qty = float(item.get("qty", 0))
        current_received = float(item.get("received_qty", 0))
        next_received = min(ordered_qty, current_received + max(0, received.qty))
        delta_received = next_received - current_received
        item["received_qty"] = next_received
        if received.price is not None:
            item["price"] = float(received.price)
        if delta_received > 0:
            ing = db.query(models.Ingredient).filter(
                models.Ingredient.name == received.name,
                models.Ingredient.owner_id == owner_id
            ).first()
            if ing:
                ing.stock += delta_received
                ing.price = float(item.get("price", ing.price))
                ing.last_purchase_price = float(item.get("price", ing.price))

    po.items = list(items_by_name.values())
    received_complete = all(float(item.get("received_qty", 0)) >= float(item.get("qty", 0)) for item in po.items)
    received_any = any(float(item.get("received_qty", 0)) > 0 for item in po.items)
    po.status = "received" if received_complete else ("partial" if received_any else po.status)
    db.commit()
    return {"success": True, "status": po.status}

@app.patch("/api/purchase-orders/{id}/status", dependencies=[Depends(requires_roles(["owner"]))])
async def update_po_status(id: str, status: str, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == id,
        models.PurchaseOrder.owner_id == owner_id
    ).first()
    
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")

    # Marking an order as fully received also backfills any remaining stock delta.
    if status == "received" and po.status != "received":
        for item in po.items:
            # item format: {name, qty, price}
            ing = db.query(models.Ingredient).filter(
                models.Ingredient.name == item['name'],
                models.Ingredient.owner_id == owner_id
            ).first()
            if ing:
                delta = max(0, float(item['qty']) - float(item.get('received_qty', 0)))
                ing.stock += delta
                ing.price = float(item['price']) # Update price to current purchase price
                ing.last_purchase_price = float(item['price'])
                item['received_qty'] = float(item['qty'])

    po.status = status
    db.commit()
    return {"success": True}

    # Expenses and exports feed the accounting side of the product.
@app.get("/api/expenses", dependencies=[Depends(requires_roles(["owner"]))])
async def get_expenses(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    return db.query(models.Expense).filter(models.Expense.owner_id == owner_id).order_by(models.Expense.date.desc()).all()

@app.post("/api/expenses", dependencies=[Depends(requires_roles(["owner"]))])
async def add_expense(exp: ExpenseCreate, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    new_exp = models.Expense(**exp.dict(), owner_id=owner_id)
    db.add(new_exp)
    db.commit()
    return {"success": True}

@app.get("/api/accounting/export", dependencies=[Depends(requires_roles(["owner"]))])
async def export_accounting(
    start: str,
    end: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id)
):
    start_date = datetime.fromisoformat(start)
    end_date = datetime.fromisoformat(end) + timedelta(days=1)

    expenses = db.query(models.Expense).filter(
        models.Expense.owner_id == owner_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date
    ).all()
    purchase_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.owner_id == owner_id,
        models.PurchaseOrder.date >= start_date,
        models.PurchaseOrder.date < end_date
    ).all()
    transactions = db.query(models.Transaction).filter(
        models.Transaction.owner_id == owner_id,
        models.Transaction.timestamp >= start_date,
        models.Transaction.timestamp < end_date,
        models.Transaction.type == "sale"
    ).all()

    output = StringIO()
    # CSV keeps the export simple to ingest in spreadsheets and accounting tools.
    writer = csv.writer(output)
    writer.writerow(["date", "entry_type", "reference", "label", "status", "amount"])
    for tx in transactions:
        writer.writerow([tx.timestamp.date().isoformat(), "sale", tx.id, "POS revenue", "posted", tx.total_revenue])
    for exp in expenses:
        writer.writerow([exp.date.date().isoformat(), "expense", exp.id, exp.description or exp.category, exp.category, -exp.amount])
    for po in purchase_orders:
        total = sum((float(item.get("qty", 0)) * float(item.get("price", 0))) for item in po.items)
        writer.writerow([po.date.date().isoformat(), "purchase_order", po.id, f"Supplier #{po.supplier_id}", po.status, -total])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="accounting-{start}-to-{end}.csv"'},
    )

@app.post("/api/maintenance/reset-session", dependencies=[Depends(requires_roles(["owner"]))])
async def reset_session(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Moving `last_reset_at` forward creates a new "current shift" window.
    now_str = datetime.now().isoformat()
    setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == "last_reset_at",
        models.SystemSetting.owner_id == owner_id
    ).first()
    if setting:
        setting.value = now_str
    else:
        setting = models.SystemSetting(key="last_reset_at", owner_id=owner_id, value=now_str)
        db.add(setting)
    db.commit()
    return {"success": True, "message": "Shift has been closed. Session profit reset to 0. Historical data preserved."}

@app.get("/api/reports/monthly")
async def get_monthly_report(
    month: int,
    year: int,
    format: str = "pdf",
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Owner-facing month-end summary available as printable HTML or PDF.
    start_date = datetime(year, month, 1)
    if month == 12: end_date = datetime(year + 1, 1, 1)
    else: end_date = datetime(year, month + 1, 1)

    transactions = db.query(models.Transaction).filter(
        models.Transaction.owner_id == owner_id,
        models.Transaction.timestamp >= start_date,
        models.Transaction.timestamp < end_date
    ).all()

    waste_records = db.query(models.WasteRecord).filter(
        models.WasteRecord.owner_id == owner_id,
        models.WasteRecord.date >= start_date,
        models.WasteRecord.date < end_date
    ).all()

    expenses = db.query(models.Expense).filter(
        models.Expense.owner_id == owner_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date
    ).all()
    total_revenue = sum(t.total_revenue for t in transactions if t.type == 'sale')
    total_cogs = sum(t.total_cost for t in transactions if t.type == 'sale')
    total_waste = sum(w.loss_cost for w in waste_records)
    total_overhead = sum(e.amount for e in expenses)
    
    net_profit = total_revenue - total_cogs - total_waste - total_overhead
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    settings = get_settings()
    currency = settings.get("currency", "MAD")

    if format.lower() == "pdf":
        return _pdf_response(
            _build_monthly_report_pdf(
                start_date=start_date,
                transactions=transactions,
                expenses=expenses,
                waste_records=waste_records,
                total_revenue=total_revenue,
                total_cogs=total_cogs,
                total_waste=total_waste,
                total_overhead=total_overhead,
                net_profit=net_profit,
                margin=margin,
                currency=currency,
            ),
            f"monthly-report-{year:04d}-{month:02d}.pdf",
        )
    
    # Generate printable HTML when the browser, rather than ReportLab, should
    # handle the final print/export step.
    html_content = f"""
    <html>
    <head>
        <title>Monthly Report - {start_date.strftime('%B %Y')}</title>
        <style>
            body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1b; line-height: 1.6; max-width: 800px; margin: 0 auto; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f1; padding-bottom: 20px; margin-bottom: 40px; }}
            .logo {{ font-size: 24px; font-weight: 800; letter-spacing: -1px; }}
            .logo span {{ color: #d4af37; }}
            .report-title {{ font-size: 32px; font-weight: 800; margin: 0; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }}
            .card { background: #f8f9fa; padding: 25px; border-radius: 15px; border: 1px solid #eee; }
            .card-label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 5px; }}
            .card-value {{ font-size: 24px; font-weight: 800; margin: 0; }}
            .positive {{ color: #10b981; }}
            .negative {{ color: #f43f5e; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 10px; border-bottom: 1px solid #eee; }}
            td {{ padding: 15px 10px; border-bottom: 1px solid #f8f9fa; font-size: 14px; font-weight: 600; }}
            .no-print {{ margin-bottom: 20px; }}
            .btn {{ background: #000; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }}
            @media print {{ .no-print {{ display: none; }} body {{ padding: 0; }} }}
        </style>
    </head>
    <body>
        <div class="no-print">
            <a href="#" class="btn" onclick="window.print()">Download as PDF</a>
        </div>
        <div class="header">
            <div class="logo">Bakery<span>OS</span></div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: bold;">Executive Financial Summary</p>
                <p style="margin: 0; color: #888; font-size: 12px;">Period: {start_date.strftime('%B %Y')}</p>
            </div>
        </div>

        <h1 class="report-title">Financial Performance</h1>
        <p style="color: #888; margin-bottom: 40px;">This report summarizes the operational efficiency and net profitability for the selected period.</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div class="card">
                <p class="card-label">Total Revenue</p>
                <p class="card-value">{total_revenue:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Net Profit</p>
                <p class="card-value { 'positive' if net_profit > 0 else 'negative' }">{net_profit:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Cost of Goods</p>
                <p class="card-value">{total_cogs:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Waste Loss</p>
                <p class="card-value" style="color: #f43f5e;">{total_waste:,.2f} {currency}</p>
            </div>
            <div class="card">
                <p class="card-label">Fixed Overhead</p>
                <p class="card-value" style="color: #f43f5e;">{total_overhead:,.2f} {currency}</p>
            </div>
        </div>

        <div class="card" style="margin-bottom: 40px; background: #000; color: #fff; border: none;">
            <p class="card-label" style="color: #aaa;">Operating Margin</p>
            <p class="card-value" style="color: #d4af37;">{margin:.1f}%</p>
        </div>

        <h3>Revenue Breakdown</h3>
        <table>
            <thead>
                <tr><th>Category</th><th>Transactions</th><th>Amount</th></tr>
            </thead>
            <tbody>
                <tr><td>Direct Sales</td><td>{len([t for t in transactions if t.type == 'sale'])}</td><td>{total_revenue:,.2f} {currency}</td></tr>
                <tr><td>Fixed Expenses</td><td>{len(expenses)}</td><td style="color: #f43f5e;">-{total_overhead:,.2f} {currency}</td></tr>
                <tr><td>Waste Deductions</td><td>{len(waste_records)}</td><td style="color: #f43f5e;">-{total_waste:,.2f} {currency}</td></tr>
            </tbody>
        </table>

        <div style="margin-top: 100px; text-align: center; font-size: 10px; color: #ccc; text-transform: uppercase; letter-spacing: 2px;">
            Generated by BakeryOS Intel-Engine | {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/api/forecast")
async def get_forecast(target_date: str, db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id)):
    # The forecast is intentionally simple: compare the same weekday over the
    # last four weeks, average it, then add a small safety buffer.
    try:
        target_dt = datetime.strptime(target_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    suggestions = []
    products = db.query(models.Product).filter(models.Product.owner_id == owner_id).all()

    # Look back at the last four matching weekdays.
    history_dates = []
    for i in range(1, 5):
        history_dates.append(target_dt - timedelta(weeks=i))

    for product in products:
        sales_data = []
        for h_date in history_dates:
            start = datetime(h_date.year, h_date.month, h_date.day)
            end = start + timedelta(days=1)

            # Count how many units of this product were sold that day.
            txs = db.query(models.Transaction).filter(
                models.Transaction.owner_id == owner_id,
                models.Transaction.type == 'sale',
                models.Transaction.timestamp >= start,
                models.Transaction.timestamp < end
            ).all()
            day_qty = 0
            for tx in txs:
                if tx.items:
                    for item in tx.items:
                        if item.get('id') == product.id:
                            day_qty += item.get('qty', 0)
            sales_data.append(day_qty)
            
        # Average + 10% safety buffer, with a small minimum so empty history
        # does not produce a zero plan.
        avg_sales = sum(sales_data) / len(sales_data) if sales_data else 0
        suggested = int(avg_sales * 1.1) + 1 if avg_sales > 0 else 5 # minimum 5
        
        suggestions.append({
            "product_id": product.id,
            "product_name": product.name,
            "suggested_qty": suggested,
            "historical_avg": round(avg_sales, 1)
        })
        
    return suggestions

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404)
        
    # 1. Serve real built assets when they exist.
    file_path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # 2. Otherwise fall back to the React app so client-side routing works.
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})
    
    return {"message": "Frontend not built. Please run 'npm run build' in frontend directory."}

if __name__ == "__main__":
    import os

    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
