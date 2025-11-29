import sqlite3
import os
db = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'db.sqlite3')
con = sqlite3.connect(db)
cur = con.cursor()
try:
    cur.execute("PRAGMA encoding;")
    print('PRAGMA encoding ->', cur.fetchone())
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='calculator_rate';")
    print('table ddl:', cur.fetchone())
finally:
    con.close()
