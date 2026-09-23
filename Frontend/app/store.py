"""Server-owned catalogue, per-session carts and single-use confirmations."""
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv('EKT_DB_PATH', ROOT / 'data' / 'app.sqlite3'))


def db():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    return connection


def init():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, csrf TEXT NOT NULL, created REAL NOT NULL, touched REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS cart(session TEXT REFERENCES sessions(id) ON DELETE CASCADE, product TEXT REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(session,product));
        CREATE TABLE IF NOT EXISTS pending(session TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, token TEXT NOT NULL, product TEXT NOT NULL, quantity INTEGER NOT NULL, price INTEGER NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY, session TEXT REFERENCES sessions(id) ON DELETE CASCADE, role TEXT NOT NULL, text TEXT NOT NULL);
        ''')
        for product in json.loads((ROOT / 'data/products.json').read_text(encoding='utf-8')):
            c.execute('INSERT OR IGNORE INTO products VALUES(?,?)', (product['id'], json.dumps(product, ensure_ascii=False)))
        c.execute('DELETE FROM sessions WHERE touched<?', (time.time() - 86400,))


def session(sid=None):
    with db() as c:
        c.execute('DELETE FROM sessions WHERE touched<?', (time.time() - 86400,))
        row = c.execute('SELECT * FROM sessions WHERE id=?', (sid or '',)).fetchone()
        if row:
            c.execute('UPDATE sessions SET touched=? WHERE id=?', (time.time(), sid))
            return dict(row)
        sid, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        now = time.time()
        c.execute('INSERT INTO sessions VALUES(?,?,?,?)', (sid, csrf, now, now))
        return dict(id=sid, csrf=csrf)


def products():
    with db() as c:
        return [json.loads(r['payload']) for r in c.execute('SELECT payload FROM products')]


def product(pid):
    with db() as c:
        row = c.execute('SELECT payload FROM products WHERE id=?', (pid,)).fetchone()
    if not row:
        raise ValueError('Тауар табылмады.')
    return json.loads(row['payload'])


def stock(p):
    return sum(s['quantity'] for s in p['stock'])


def cart(sid):
    with db() as c:
        rows = c.execute('SELECT product,quantity FROM cart WHERE session=?', (sid,)).fetchall()
    items = [dict(product=product(r['product']), quantity=r['quantity']) for r in rows]
    return dict(items=items, total=sum(i['product']['price'] * i['quantity'] for i in items), count=sum(i['quantity'] for i in items), url='/cart')


def pending(sid):
    with db() as c:
        c.execute('DELETE FROM pending WHERE created<?', (time.time()-600,))
        row = c.execute('SELECT * FROM pending WHERE session=?', (sid,)).fetchone()
    if not row:
        return None
    result = dict(row)
    result['product'] = product(result['product'])
    return result


def prepare(sid, pid, quantity):
    if type(quantity) is not int or not 1 <= quantity <= 10000:
        raise ValueError('Саны 1–10000 аралығындағы бүтін сан болуы керек.')
    p = product(pid)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        existing = c.execute('SELECT quantity FROM cart WHERE session=? AND product=?', (sid, pid)).fetchone()
        current = existing['quantity'] if existing else 0
        if current + quantity > stock(p):
            raise ValueError(f'Қоймада {stock(p)} дана бар. Себетте {current} дана. Қосуға қолжетімді: {max(0, stock(p)-current)} дана.')
        c.execute('INSERT OR REPLACE INTO pending VALUES(?,?,?,?,?,?)', (sid, secrets.token_urlsafe(24), pid, quantity, p['price'], time.time()))
    return pending(sid)


def confirm(sid, token, accepted):
    if accepted is not True:
        raise ValueError('Нақты растау қажет. Себет өзгерген жоқ.')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT * FROM pending WHERE session=? AND token=?', (sid, token)).fetchone()
        if not row or time.time()-row['created'] > 600:
            raise ValueError('Растау ескірген немесе бұрын қолданылған. Қайта таңдаңыз.')
        p = json.loads(c.execute('SELECT payload FROM products WHERE id=?', (row['product'],)).fetchone()['payload'])
        old = c.execute('SELECT quantity FROM cart WHERE session=? AND product=?', (sid, p['id'])).fetchone()
        quantity = row['quantity'] + (old['quantity'] if old else 0)
        if p['price'] != row['price']:
            raise ValueError('Баға өзгерді. Тауарды қайта таңдап, жаңа бағаны растаңыз.')
        if quantity > stock(p):
            raise ValueError(f'Қалдық өзгерді: қазір {stock(p)} дана бар. Себет өзгерген жоқ.')
        c.execute('INSERT OR REPLACE INTO cart VALUES(?,?,?)', (sid, p['id'], quantity))
        c.execute('DELETE FROM pending WHERE session=?', (sid,))
    return cart(sid)


def cancel(sid):
    with db() as c:
        c.execute('DELETE FROM pending WHERE session=?', (sid,))


def history(sid):
    with db() as c:
        rows = c.execute('SELECT role,text FROM (SELECT id,role,text FROM history WHERE session=? ORDER BY id DESC LIMIT 16) ORDER BY id', (sid,)).fetchall()
    return [dict(role=r['role'], content=r['text']) for r in rows]


def remember(sid, user, answer):
    with db() as c:
        c.executemany('INSERT INTO history(session,role,text) VALUES(?,?,?)', [(sid,'user',user[:4000]),(sid,'assistant',answer[:6000])])
        c.execute('DELETE FROM history WHERE session=? AND id NOT IN (SELECT id FROM history WHERE session=? ORDER BY id DESC LIMIT 16)', (sid,sid))
