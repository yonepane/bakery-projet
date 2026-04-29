import io
import xlsxwriter
from datetime import datetime

def build_monthly_report_excel(
    start_date,
    transactions,
    expenses,
    waste_records,
    total_revenue,
    total_cogs,
    total_waste,
    total_overhead,
    net_profit,
    margin,
    currency
):
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Define formats
    title_format = workbook.add_format({'bold': True, 'font_size': 24, 'font_color': '#D4AF37'})
    header_format = workbook.add_format({'bold': True, 'bg_color': '#F8F9FA', 'border': 1})
    currency_format = workbook.add_format({'num_format': f'#,##0.00 "{currency}"'})
    bold_currency_format = workbook.add_format({'bold': True, 'num_format': f'#,##0.00 "{currency}"'})
    percent_format = workbook.add_format({'bold': True, 'num_format': '0.0%'})
    
    # 1. Summary Sheet
    ws_summary = workbook.add_worksheet('Financial Summary')
    ws_summary.set_column('A:A', 25)
    ws_summary.set_column('B:B', 20)
    
    ws_summary.write('A1', 'BakeryOS Financial Summary', title_format)
    ws_summary.write('A2', f"Period: {start_date.strftime('%B %Y')}")
    
    ws_summary.write('A4', 'Metric', header_format)
    ws_summary.write('B4', 'Value', header_format)
    
    data = [
        ['Total Revenue', total_revenue, bold_currency_format],
        ['Cost of Goods Sold', total_cogs, currency_format],
        ['Waste Deductions', total_waste, currency_format],
        ['Fixed Overhead', total_overhead, currency_format],
        ['Net Profit', net_profit, bold_currency_format],
        ['Operating Margin', margin / 100.0, percent_format]
    ]
    
    row = 4
    for item in data:
        ws_summary.write(row, 0, item[0])
        ws_summary.write(row, 1, item[1], item[2])
        row += 1
        
    # Add a pie chart for expenses
    chart = workbook.add_chart({'type': 'pie'})
    chart.add_series({
        'name': 'Cost Breakdown',
        'categories': ['Financial Summary', 5, 0, 7, 0],
        'values':     ['Financial Summary', 5, 1, 7, 1],
        'data_labels': {'percentage': True}
    })
    chart.set_title({'name': 'Revenue Deductions'})
    ws_summary.insert_chart('D4', chart)
    
    # 2. Transactions Sheet
    ws_tx = workbook.add_worksheet('Transactions')
    ws_tx.write_row('A1', ['ID', 'Date', 'Revenue', 'Cost'], header_format)
    ws_tx.set_column('A:B', 20)
    ws_tx.set_column('C:D', 15)
    
    row = 1
    for t in sorted([tx for tx in transactions if tx.type == 'sale'], key=lambda x: x.timestamp):
        ws_tx.write(row, 0, t.id)
        ws_tx.write(row, 1, t.timestamp.strftime('%Y-%m-%d %H:%M:%S'))
        ws_tx.write(row, 2, t.total_revenue, currency_format)
        ws_tx.write(row, 3, t.total_cost, currency_format)
        row += 1

    # Add a column chart for daily revenue
    if transactions:
        tx_chart = workbook.add_chart({'type': 'column'})
        tx_chart.add_series({
            'name': 'Revenue',
            'categories': ['Transactions', 1, 1, row - 1, 1],
            'values':     ['Transactions', 1, 2, row - 1, 2],
        })
        tx_chart.set_title({'name': 'Sales Over Time'})
        tx_chart.set_x_axis({'name': 'Date'})
        tx_chart.set_y_axis({'name': currency})
        ws_tx.insert_chart('F2', tx_chart, {'x_scale': 1.5})
        
    # 3. Expenses Sheet
    ws_exp = workbook.add_worksheet('Expenses')
    ws_exp.write_row('A1', ['Date', 'Category', 'Description', 'Amount'], header_format)
    ws_exp.set_column('A:D', 20)
    row = 1
    for e in sorted(expenses, key=lambda x: x.date):
        ws_exp.write(row, 0, e.date.strftime('%Y-%m-%d'))
        ws_exp.write(row, 1, e.category)
        ws_exp.write(row, 2, e.description or '')
        ws_exp.write(row, 3, e.amount, currency_format)
        row += 1
        
    # 4. Waste Sheet
    ws_waste = workbook.add_worksheet('Waste')
    ws_waste.write_row('A1', ['Date', 'Product ID', 'Quantity', 'Loss Cost'], header_format)
    ws_waste.set_column('A:D', 20)
    row = 1
    for w in sorted(waste_records, key=lambda x: x.date):
        ws_waste.write(row, 0, w.date.strftime('%Y-%m-%d'))
        ws_waste.write(row, 1, w.product_id)
        ws_waste.write(row, 2, w.quantity)
        ws_waste.write(row, 3, w.loss_cost, currency_format)
        row += 1
        
    workbook.close()
    output.seek(0)
    return output
