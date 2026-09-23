"""One-off EKT API catalogue fetch; never used by the chat request path."""
import os
import httpx


DEFAULT_URL = 'https://ekt.kz/api/products'


def _value(record, *names):
    for name in names:
        value = record.get(name)
        if value not in (None, ''):
            return value
    return None


def _text(value, field):
    if isinstance(value, dict):
        value = _value(value, 'name', 'title', 'slug')
    if not isinstance(value, (str, int)) or not str(value).strip():
        raise ValueError(f'EKT API дерегінде «{field}» өрісі жоқ немесе жарамсыз.')
    return str(value).strip()


def _integer(value, field):
    if isinstance(value, bool) or isinstance(value, float) and not value.is_integer():
        raise ValueError(f'EKT API дерегіндегі «{field}» бүтін сан болуы керек.')
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'EKT API дерегіндегі «{field}» бүтін сан болуы керек.') from None
    if number < 0:
        raise ValueError(f'EKT API дерегіндегі «{field}» теріс болмауы керек.')
    return number


def normalize(record):
    if not isinstance(record, dict):
        raise ValueError('EKT API тауар жазбасы объект болуы керек.')
    # Confirmed by the case brief: endpoint and Basic Auth only. No response fields
    # are confirmed, so id/article/name/brand/category and all alternate names below
    # are explicit assumptions to verify against the agreed test API schema.
    price = record.get('price')
    price_value = _value(price, 'amount', 'value') if isinstance(price, dict) else price
    currency = _value(record, 'currency') or (_value(price, 'currency') if isinstance(price, dict) else None)
    specs = _value(record, 'specifications', 'attributes')
    if isinstance(specs, list):
        # Assumed alternate attribute shape: [{"name": "...", "value": "..."}].
        specs = {str(x['name']): x['value'] for x in specs if isinstance(x, dict) and 'name' in x and 'value' in x}
    if not isinstance(specs, dict):
        raise ValueError('EKT API дерегіндегі «specifications/attributes» объект болуы керек.')
    raw_stock = _value(record, 'stock', 'stocks')
    if isinstance(raw_stock, (int, str)):
        raw_stock = [dict(warehouse='EKT', quantity=raw_stock)]
    if raw_stock is None:
        quantity = _value(record, 'stock_quantity', 'available_quantity', 'quantity')
        raw_stock = [dict(warehouse='EKT', quantity=quantity)] if quantity is not None else None
    if not isinstance(raw_stock, list):
        raise ValueError('EKT API дерегіндегі «stock» тізім болуы керек.')
    stock = []
    for item in raw_stock:
        if not isinstance(item, dict):
            raise ValueError('EKT API қор жазбасы объект болуы керек.')
        stock.append(dict(warehouse=_text(_value(item, 'warehouse', 'name', 'location') or 'EKT', 'stock.warehouse'),
                          quantity=_integer(_value(item, 'quantity', 'available_quantity', 'stock_quantity'), 'stock.quantity')))
    certificate = _value(record, 'certificate_url', 'certificate')
    if isinstance(certificate, dict):
        certificate = _value(certificate, 'url')
    normalized = dict(
        id=_text(_value(record, 'id', 'product_id'), 'id'),
        article=_text(_value(record, 'article', 'sku'), 'article/sku'),
        name=_text(_value(record, 'name', 'title'), 'name/title'),
        brand=_text(_value(record, 'brand', 'manufacturer'), 'brand/manufacturer'),
        category=_text(_value(record, 'category', 'category_slug'), 'category'),
        price=_integer(price_value, 'price'),
        currency=_text(currency, 'currency'),
        unit=_text(_value(record, 'unit', 'unit_name'), 'unit'),
        specifications=specs,
        stock=stock,
        certificate_url=certificate or '',
        is_demo=False,
    )
    if normalized['currency'] != 'KZT':
        raise ValueError('EKT API валютасы KZT болуы керек.')
    if normalized['certificate_url'] and not str(normalized['certificate_url']).startswith('https://'):
        raise ValueError('EKT API сертификат сілтемесі HTTPS болуы керек.')
    return normalized


def _page_records(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        raise ValueError('EKT API жауабы тізім не объект болуы керек.')
    for key in ('data', 'items', 'products'):
        if key in payload:
            if not isinstance(payload[key], list):
                raise ValueError(f'EKT API «{key}» өрісі тізім болуы керек.')
            return payload[key]
    raise ValueError('EKT API жауабында data, items немесе products тізімі жоқ.')


def _next_page(payload, page, size, count):
    if not isinstance(payload, dict):
        return page + 1 if count == size else None
    next_page = payload.get('next_page')
    if next_page is not None:
        return _integer(next_page, 'next_page') or None
    meta = payload.get('meta', {})
    if isinstance(meta, dict) and meta.get('current_page') is not None and meta.get('last_page') is not None:
        return page + 1 if _integer(meta['current_page'], 'meta.current_page') < _integer(meta['last_page'], 'meta.last_page') else None
    return page + 1 if count == size else None


def fetch_catalog():
    """Fetch and normalize every API page for `python -m app.import_catalog --source=ekt`."""
    login, password = os.getenv('EKT_API_LOGIN'), os.getenv('EKT_API_PASSWORD')
    if not login or not password:
        raise RuntimeError('EKT API импортын орындау үшін EKT_API_LOGIN және EKT_API_PASSWORD баптаңыз.')
    url = os.getenv('EKT_API_BASE_URL', DEFAULT_URL).strip() or DEFAULT_URL
    page, size, records = 1, 100, []
    try:
        with httpx.Client(timeout=20, auth=(login, password), follow_redirects=False) as client:
            while page:
                response = client.get(url, params=dict(page=page, per_page=size))
                response.raise_for_status()
                payload = response.json()
                current = _page_records(payload)
                records.extend(normalize(item) for item in current)
                page = _next_page(payload, page, size, len(current))
                if page and page > 10000:
                    raise ValueError('EKT API беттеу шегі асып кетті.')
    except httpx.HTTPError as exc:
        raise RuntimeError(f'EKT API каталогына қосылу не жауапты оқу мүмкін болмады: {exc}') from exc
    if not records:
        raise RuntimeError('EKT API каталогы бос жауап қайтарды.')
    ids = [p['id'] for p in records]
    if len(ids) != len(set(ids)):
        raise ValueError('EKT API каталогында қайталанатын тауар ID бар.')
    return records
