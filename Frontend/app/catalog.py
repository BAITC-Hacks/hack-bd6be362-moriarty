import re
from . import store

TERMS = {
    'demo': True,
    'payment': 'Тест шарты: төлем шот бойынша банктік аударыммен жасалады. Чат төлем деректерін қабылдамайды.',
    'delivery': 'Тест шарты: қоймадан алып кету немесе Қазақстан бойынша жеткізу. Бағасы мен мерзімін менеджер нақтылайды.',
    'minimum': 'Тест шарты: дана тауарлар үшін ең аз партия — 1 дана; кабель үшін — 1 метр.',
    'notice': 'Бұл ekt.kz нақты коммерциялық шарттары емес. Серіктес деректерімен ауыстыру қажет.'
}


def search(query):
    q = query.lower().replace('с16', 'c16').replace('с25', 'c25')
    all_products = store.products()
    articles = re.findall(r'demo-\d+', q)
    if articles:
        return [p for p in all_products if p['article'].lower() in articles]
    amps = re.search(r'(?:[bc]|[бс])\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:а\b|a\b|ампер|амперлік)', q)
    current = int(next(v for v in amps.groups() if v)) if amps else None
    curve_match = re.search(r'\b([bcd])\s*\d{1,3}\b',q)
    poles_match = re.search(r'\b([1-4])\s*[pр]\b',q)
    cable_match = re.search(r'\b(\d+)\s*[xх×]\s*(\d+(?:[.,]\d+)?)',q)
    tokens = re.findall(r'[\w.]+', q)
    categories = [('автомат','breaker'),('ажыратқыш','breaker'),('кабель','cable'),('розет','socket'),('шам','light'),('свет','light'),('ламп','light')]
    category = next((value for word,value in categories if word in q), None)
    ranked = []
    for p in all_products:
        if current is not None and p['specifications'].get('current_a') != current:
            continue
        if category and p['category'] != category:
            continue
        if curve_match and p['specifications'].get('curve') != curve_match.group(1).upper():
            continue
        if poles_match and p['specifications'].get('poles') != int(poles_match.group(1)):
            continue
        if cable_match and (p['specifications'].get('cores') != int(cable_match.group(1)) or p['specifications'].get('cross_section_mm2') != float(cable_match.group(2).replace(',','.'))):
            continue
        text = (p['name']+' '+p['article']+' '+p['brand']+' '+str(p['specifications'])).lower()
        score = sum(1 for t in tokens if len(t)>1 and t in text)
        if score or current is not None or category or not q.strip():
            ranked.append((score,p))
    return [p for _,p in sorted(ranked,key=lambda x:-x[0])][:8]


def analogs(pid):
    source = store.product(pid)
    results = []
    for p in store.products():
        if p['id'] == pid or p['category'] != source['category'] or store.stock(p) == 0:
            continue
        # All represented technical fields must match; amperage alone is insufficient.
        if p['specifications'] == source['specifications']:
            results.append(dict(product=p, reason='Каталогтағы барлық негізгі параметрлері сәйкес: '+', '.join(f'{k}: {v}' for k,v in p['specifications'].items())+'. Нақты қолдануға жарамдылығын маман тексеруі керек.'))
    return results[:3]
