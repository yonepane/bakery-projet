import sqlite3

conn = sqlite3.connect('/home/dane/bakery-os/backend/bakeryos.db')
cursor = conn.cursor()

owner_3 = [
    'B617BBCB', 'FD2C3CA7', 'AAE796C9', '3F726CD0', 'FA2032DA', 'D3AEB97A', '4CD399EA', '745D5175',
    'C6EA1356', '5054DFAB-9A9', '10D50CA7-A32', '421CF6F8-6A5', '6CF28277-DDB', '4E93FEED-80A',
    'CDCCDE11-D0B', '1DD3FBF3-74C', 'C8364B01-402', '3E41CB50-105', '57AEA177-B23'
]

owner_1 = [
    'B2644F9D', '249F326E', 'E62C85B6', '04C85FA6', '13420538', '83879D18', '741DD1F1', '6364936C',
    '9EFEC024', 'C2A22366', 'F3C4641E', 'E7938EDE', '8E7C9F46', 'AA82E953', 'B8050CDB', '62CC584C',
    '30E4CEDD', '6C7E277C', '970E6E52', '9A057A32', '66C4FE80', '229A70A1', '19A30757', '83D3BEF7',
    '9B7657EF', 'E8B36530', '1302F6B7', 'F8484EAC', 'D2262E09', '7E79528A'
]

for tx in owner_3:
    cursor.execute("UPDATE transactions SET owner_id = 3 WHERE id = ?", (tx,))

for tx in owner_1:
    cursor.execute("UPDATE transactions SET owner_id = 1 WHERE id = ?", (tx,))

conn.commit()
conn.close()
print("Done reverting transactions.")
