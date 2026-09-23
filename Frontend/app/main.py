import asyncio
import os
import secrets
import re
from contextlib import asynccontextmanager
from urllib.parse import urlsplit
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StrictBool, StrictInt
from . import store, catalog, agent, uploads

load_dotenv(store.ROOT / '.env')
LOCKS = {}


def reject_payment_data(text):
    if re.search(r'(?<!\d)(?:\d[ -]?){13,19}(?!\d)',text) or re.search(r'\b(?:cvv|cvc|pin)\s*[:=]?\s*\d{3,6}\b',text,re.I):
        raise ValueError('Төлем деректерін чатқа жібермеңіз. Бұл хабарлама сақталмады. Тауардың артикулын ғана жазыңыз.')


@asynccontextmanager
async def lifespan(app):
    store.init()
    yield


app = FastAPI(title='EKT Assistant · HACKALEM prototype', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=store.ROOT/'static'), name='static')


@app.middleware('http')
async def security(request, call_next):
    if request.url.path.startswith('/api/'):
        host=request.headers.get('host','')
        if host.split(':')[0] not in ['127.0.0.1','localhost']:
            return JSONResponse({'detail':'Local prototype: host not allowed.'},status_code=400)
        state=store.session(request.cookies.get('ekt_session'))
        request.state.session=state
        if request.method not in ['GET','HEAD','OPTIONS']:
            origin=request.headers.get('origin')
            if (origin and urlsplit(origin).netloc != host) or not secrets.compare_digest(request.headers.get('x-csrf-token',''),state['csrf']):
                return JSONResponse({'detail':'Сессияны жаңартып, қайталап көріңіз.'},status_code=403)
        response=await call_next(request)
        response.set_cookie('ekt_session',state['id'],httponly=True,samesite='strict',secure=os.getenv('COOKIE_SECURE')=='1',max_age=86400)
        response.headers['Cache-Control']='no-store'
    else:
        response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='same-origin'
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    return response


@app.exception_handler(ValueError)
async def value_error(request, exc):
    return JSONResponse({'detail':str(exc)},status_code=400)


@app.get('/')
@app.get('/cart')
def index():
    return FileResponse(store.ROOT/'static/index.html')


@app.get('/certificates/demo-certificate.txt')
def certificate():
    return FileResponse(store.ROOT/'data/demo-certificate.txt',media_type='text/plain; charset=utf-8')


@app.get('/api/session')
def session_info(request: Request):
    sid=request.state.session['id']
    return dict(csrf=request.state.session['csrf'],ai_available=bool(os.getenv('OPENAI_API_KEY')),history=store.history(sid),pending=store.pending(sid),cart=store.cart(sid))


@app.get('/api/products')
def products(q: str=''):
    return catalog.search(q) if q else store.products()


@app.get('/api/terms')
def terms():
    return catalog.TERMS


@app.get('/api/cart')
def cart(request: Request):
    return store.cart(request.state.session['id'])


class Prepare(BaseModel):
    product_id: str = Field(max_length=30)
    quantity: StrictInt = Field(ge=1,le=10000)


class Confirm(BaseModel):
    token: str = Field(max_length=100)
    accepted: StrictBool


@app.post('/api/cart/prepare')
def prepare(body: Prepare, request: Request):
    return store.prepare(request.state.session['id'],body.product_id,body.quantity)


@app.post('/api/cart/confirm')
def confirm(body: Confirm, request: Request):
    sid=request.state.session['id']
    result=store.confirm(sid,body.token,body.accepted)
    store.remember(sid,'Иә, қос (растау батырмасы)','Тауар себетке қосылды. Себетті ашу: /cart')
    return result


@app.post('/api/cart/cancel')
def cancel(request: Request):
    store.cancel(request.state.session['id'])
    return {'ok':True}


@app.post('/api/chat')
async def chat(request: Request, message: str=Form(...,max_length=4000), mode: str=Form('demo'), cloud_consent: bool=Form(False), confirmation_token: str=Form(''), file: UploadFile | None=File(None)):
    sid=request.state.session['id']
    lock=LOCKS.setdefault(sid,asyncio.Lock())
    if lock.locked():
        raise HTTPException(429,'Алдыңғы жауапты күтіңіз.')
    async with lock:
        message=message.strip()
        if not message:
            raise ValueError('Сұрағыңызды жазыңыз.')
        reject_payment_data(message)
        yes=message.lower().strip(' .!') in ['иә, қос','иә қос','да, добавь','да добавь']
        if yes and not file:
            if not confirmation_token:
                raise ValueError('Алдымен тауар мен санын таңдаңыз, содан кейін көрсетілген ұсынысты растаңыз.')
            result=store.confirm(sid,confirmation_token,True)
            answer='Тауар себетке қосылды. Себетті ашу: /cart'
            store.remember(sid,message,answer)
            return dict(answer=answer,products=[],cart=result,pending=None,mode='server')
        if message.lower().strip(' .!') in ['жоқ','бас тарту','нет','отмена']:
            store.cancel(sid)
            return dict(answer='Ұсыныс жойылды. Себет өзгерген жоқ.',products=[],cart=store.cart(sid),pending=None,mode='server')
        attachment=None
        if file:
            data=await file.read(uploads.MAX_BYTES+1)
            try:
                attachment=await asyncio.to_thread(uploads.extract,file.filename or '',data)
            except ValueError:
                raise
            except Exception:
                raise ValueError('Файл оқылмады. Форматын және бүлінбегенін тексеріңіз.')
            finally:
                await file.close()
            reject_payment_data(attachment.get('text',''))
        store.cancel(sid)
        if mode=='ai':
            if not os.getenv('OPENAI_API_KEY'):
                raise ValueError('API кілті бапталмаған. Демо режимін таңдаңыз.')
            if not cloud_consent:
                raise ValueError('ЖИ режимі үшін мәтін мен тіркемені OpenAI-ға жіберуге келісім қажет.')
            try:
                answer,found,used=await asyncio.to_thread(agent.cloud,sid,message,attachment)
            except Exception:
                store.cancel(sid)
                raise HTTPException(502,'ЖИ қызметі жауап бермеді. API кілтін, модельге қолжетімділікті және желіні тексеріңіз. Демо режимін қолдануға болады.')
        elif mode=='demo':
            answer,found,used=agent.demo(sid,message,attachment)
        else:
            raise ValueError('Белгісіз режим.')
        # File contents are not persisted in history.
        store.remember(sid,message,answer)
        return dict(answer=answer,products=found,cart=store.cart(sid),pending=store.pending(sid),mode=used,attachment=dict(name=attachment['name'],truncated=attachment.get('truncated',False)) if attachment else None)
