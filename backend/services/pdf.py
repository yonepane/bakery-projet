"""PDF and receipt generation helpers for BakeryOS.

All ReportLab PDF builders live here so that routers and main.py stay
focused on HTTP concerns rather than document layout details.
"""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

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


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def format_money(value: float, currency: str) -> str:
    return f"{value:,.2f} {currency}"


def safe_pdf_text(value) -> str:
    return escape(str(value or ""))


def report_styles() -> dict:
    """Return the text styles shared by all PDF reports and receipts."""
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


# ---------------------------------------------------------------------------
# Receipt PDF
# ---------------------------------------------------------------------------

def build_receipt_pdf(tx, currency: str, paper: str = "80mm", bakery_name: str = "BakeryOS") -> BytesIO:
    """Build the PDF for one sale receipt.

    Args:
        tx: The Transaction ORM object.
        currency: ISO currency code to display on the receipt.
        paper: Paper width, either "58mm" or "80mm".
        bakery_name: The tenant's bakery name, shown under the header.
    """
    styles = report_styles()
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
        Paragraph(safe_pdf_text(bakery_name), styles["receipt_meta"]),
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
            name = safe_pdf_text(item.get("name", "Product"))
            price = float(item.get("price", 0))
            line_rows.append([
                Paragraph(f"{name}<br/><font size='8' color='#71717a'>x{qty} @ {price:.2f} {currency}</font>", styles["receipt_body"]),
                Paragraph(format_money(round(price * qty, 2), currency), styles["receipt_body_right"]),
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
            Paragraph(format_money(round(tx.total_revenue, 2), currency), styles["receipt_body_right"]),
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


# ---------------------------------------------------------------------------
# Monthly financial report PDF
# ---------------------------------------------------------------------------

def build_monthly_report_pdf(
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
    """Build the monthly accounting report PDF shown in the reporting screens."""
    styles = report_styles()
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
        ("Total Revenue", format_money(total_revenue, currency), colors.HexColor("#111111"), colors.white),
        ("Net Profit", format_money(net_profit, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#10b981") if net_profit >= 0 else colors.HexColor("#f43f5e")),
        ("Cost of Goods", format_money(total_cogs, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#111111")),
        ("Waste Loss", format_money(total_waste, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#f43f5e")),
        ("Fixed Overhead", format_money(total_overhead, currency), colors.HexColor("#f8f9fa"), colors.HexColor("#f43f5e")),
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
            Paragraph(format_money(total_revenue, currency), styles["body_right"]),
        ],
        [
            Paragraph("Fixed Expenses", styles["body"]),
            Paragraph(str(len(expenses)), styles["body"]),
            Paragraph(f"-{format_money(total_overhead, currency)}", styles["body_right"]),
        ],
        [
            Paragraph("Waste Deductions", styles["body"]),
            Paragraph(str(len(waste_records)), styles["body"]),
            Paragraph(f"-{format_money(total_waste, currency)}", styles["body_right"]),
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
