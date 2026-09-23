"""Explicit validated catalogue refresh: python -m app.import_catalog data/products.json"""
import json
import sys
from pathlib import Path
from . import store


def run(path):
    records=json.loads(Path(path).read_text(encoding='utf-8-sig'))
    ids=set()
    for p in records:
        for field in ['id','article','name','brand','category','price','currency','unit','specifications','stock','certificate_url','is_demo']:
            if field not in p:raise ValueError(f'Missing field: {field}')
        if p['id'] in ids:raise ValueError('Duplicate product ID')
        ids.add(p['id'])
        if type(p['price']) is not int or p['price']<0:raise ValueError('Price must be a nonnegative integer in KZT')
        if p['currency']!='KZT':raise ValueError('Only KZT is supported')
        if not isinstance(p['specifications'],dict):raise ValueError('Specifications must be an object')
        if any(type(w['quantity']) is not int or w['quantity']<0 for w in p['stock']):raise ValueError('Invalid stock')
        if p['certificate_url'] and not p['certificate_url'].startswith(('/certificates/','https://')):raise ValueError('Invalid certificate URL')
    store.init()
    with store.db() as c:
        for p in records:
            c.execute('INSERT INTO products VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',(p['id'],json.dumps(p,ensure_ascii=False)))
    print(f'Imported {len(records)} products. Existing IDs updated; absent IDs retained.')


if __name__=='__main__':
    run(sys.argv[1] if len(sys.argv)>1 else store.ROOT/'data/products.json')
