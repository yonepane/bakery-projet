import sqlite3

conn = sqlite3.connect('/home/dane/bakery-os/backend/bakeryos.db')
cursor = conn.cursor()
try:
    cursor.execute('ALTER TABLE orders ADD COLUMN notes VARCHAR')
    conn.commit()
    print('Added notes column successfully')
except Exception as e:
    print(f'Error: {e}')
finally:
    conn.close()
