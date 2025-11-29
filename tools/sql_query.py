import sqlite3
import os

db = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'db.sqlite3')
print('db:', db)
if not os.path.exists(db):
    print('db not found')
    raise SystemExit(1)

con = sqlite3.connect(db)
cur = con.cursor()
try:
    cur.execute('SELECT id, origin_city, destination_city, container_type, transport_type, rate, input_date FROM calculator_rate ORDER BY id DESC LIMIT 1')
    row = cur.fetchone()
    if not row:
        print('no rows')
    else:
        print(row)
except Exception as e:
    print('error', e)
finally:
    con.close()
