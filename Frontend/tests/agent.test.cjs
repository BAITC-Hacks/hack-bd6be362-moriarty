// Dependency-free browser behavior tests: node --test tests/agent.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../static/index.html'), 'utf8');
const product = {id:'p002',article:'DEMO-002',name:'Demo автомат',brand:'Demo',category:'breaker',unit:'дана',price:2660,stock:[{warehouse:'Demo',quantity:14}],specifications:{current_a:16},certificate_url:'/certificates/demo-certificate.txt'};
const emptyCart = () => ({count:0,total:0,items:[],url:'/cart'});
const tick = () => new Promise(resolve=>setImmediate(resolve));

function setup(){
  const all=[];
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.value='';this.files=[];this.hidden=false;this.disabled=false;this.className='';this.textContent='';all.push(this);}
    append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
    replaceChildren(...children){this.children=[];this.append(...children);}
    setAttribute(key,value){this.attributes[key]=value;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...(child.querySelectorAll?.(selector)||[])]);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    focus(){document.activeElement=this;}
    scrollIntoView(){}
    contains(target){return target===this||this.children.some(child=>child.contains?.(target));}
  }
  function matches(node,selector){return selector.startsWith('.')?(node.className||'').split(' ').includes(selector.slice(1)):node.tagName===selector;}
  const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
  const panel=new Element();panel.className='chat-panel';panel.append(ids.message);
  const document={readyState:'loading',activeElement:null,getElementById:id=>ids[id],createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),querySelector:selector=>selector==='.chat-panel'?panel:null,querySelectorAll:selector=>selector.includes('[data-ekt-action]')?[ids.send,ids.mode,ids.attachment,ids.consent,...all.filter(node=>node.dataset.ektAction)]:[],addEventListener(name,fn){if(name==='DOMContentLoaded')this.start=fn;}};
  ids.mode.value='demo';
  const server={pending:null,cart:emptyCart(),csrf:'csrf-1',offline:false,failConfirm:false,chatGate:null,searchGate:null};
  const calls=[];
  const response=(data,status=200)=>({ok:status<400,status,headers:{get:()=> 'application/json'},json:async()=>structuredClone(data)});
  const fetch=async(url,options)=>{
    calls.push({url,...options});
    if(server.offline)throw new TypeError('Offline');
    if(url==='/api/session')return response({csrf:server.csrf,ai_available:false,history:[],cart:server.cart,pending:server.pending});
    if(url.startsWith('/api/products')){if(server.searchGate&&url.includes('old'))await server.searchGate;return response(url.includes('missing')?[]:[{...product,name:url.includes('old')?'old':'new'}]);}
    if(url==='/api/cart')return response(server.cart);
    assert.equal(options.headers['X-CSRF-Token'],server.csrf);
    if(url==='/api/cart/prepare'){
      const body=JSON.parse(options.body);server.pending={product,quantity:body.quantity,price:product.price,token:'one-use-token'};return response(server.pending);
    }
    if(url==='/api/cart/confirm'){
      const body=JSON.parse(options.body);assert.equal(body.token,server.pending.token);
      server.cart={count:server.pending.quantity,total:server.pending.quantity*product.price,items:[{product,quantity:server.pending.quantity}],url:'/cart'};server.pending=null;
      if(server.failConfirm)throw new TypeError('Response lost after commit');
      return response(server.cart);
    }
    if(url==='/api/cart/cancel'){server.pending=null;return response({ok:true});}
    if(url==='/api/chat'){
      if(server.chatGate)await server.chatGate;
      assert.ok(options.body instanceof FormData);server.pending=null;
      return response({answer:'Каталог жауабы',products:[product],pending:null,cart:server.cart});
    }
    throw new Error('Unexpected endpoint: '+url);
  };
  const location={protocol:'http:',origin:'http://localhost',pathname:'/',assign(url){this.destination=url;}};
  const context=vm.createContext({document,window:{},location,fetch,FormData,AbortController,URL,Intl,TypeError,console,setTimeout:(fn,delay)=>{const timer=setTimeout(fn,delay);timer.unref();return timer;},clearTimeout});
  vm.runInContext(source,context);
  document.start();
  return {agent:context.window.EKTAgent,ids,server,calls,panel,location,context,async ready(){for(let i=0;i<10;i++)await tick();assert.equal(ids.send.disabled,false);}};
}

test('initializes using the existing GET session API and exports only one agent',async()=>{
  const env=setup();await env.ready();
  assert.equal(env.calls[0].url,'/api/session');
  assert.equal(env.calls[0].method,undefined);
  vm.runInContext(source,env.context);assert.equal(env.context.window.EKTAgent,env.agent);
  assert.equal(env.calls.filter(call=>call.url==='/api/session').length,1);
  env.agent.close();assert.equal(env.panel.hidden,true);
  env.agent.open();assert.equal(env.panel.hidden,false);
});

test('prepare never adds to cart; confirmation posts token and updates counts',async()=>{
  const env=setup();await env.ready();await env.agent.requestAdd('DEMO-002',2);
  assert.equal(env.server.cart.count,0);assert.equal(env.ids.proposal.hidden,false);
  await env.agent.confirm();assert.equal(env.server.cart.count,2);assert.equal(env.ids['cart-count'].textContent,2);assert.equal(env.ids.proposal.hidden,true);
  await env.agent.confirm();assert.equal(env.calls.filter(call=>call.url==='/api/cart/confirm').length,1);
});

test('invalid quantities and unknown articles do not prepare any proposal',async()=>{
  const env=setup();await env.ready();
  for(const quantity of [0,-1,1.5,10001,'2',NaN])await env.agent.requestAdd('DEMO-002',quantity);
  await env.agent.requestAdd('missing',1);
  assert.equal(env.calls.filter(call=>call.url==='/api/cart/prepare').length,0);
});

test('chat and confirmation cannot run concurrently; old proposal is hidden immediately',async()=>{
  const env=setup();await env.ready();await env.agent.requestAdd('DEMO-002',2);
  let release;env.server.chatGate=new Promise(resolve=>release=resolve);
  const sending=env.agent.send('DEMO-002 бар ма?');
  assert.equal(env.ids.proposal.hidden,true);assert.equal(env.ids.send.disabled,true);
  await env.agent.confirm();await env.agent.requestAdd('DEMO-002',3);
  assert.equal(env.calls.filter(call=>call.url==='/api/cart/confirm').length,0);
  assert.equal(env.calls.filter(call=>call.url==='/api/cart/prepare').length,1);
  release();await sending;assert.equal(env.ids.send.disabled,false);
  assert.ok(env.ids.messages.querySelectorAll('button').length>=2);
});

test('lost confirmation response reads current cart without replaying the POST',async()=>{
  const env=setup();await env.ready();await env.agent.requestAdd('DEMO-002',2);env.server.failConfirm=true;
  await env.agent.confirm();assert.equal(env.server.cart.count,2);assert.equal(env.ids['cart-count'].textContent,2);
  assert.equal(env.ids.proposal.hidden,true);assert.equal(env.ids.send.disabled,false);
  assert.equal(env.calls.filter(call=>call.url==='/api/cart/confirm').length,1);
});

test('cancel leaves cart empty and messages enforce length and AI consent',async()=>{
  const env=setup();await env.ready();await env.agent.requestAdd('DEMO-002');await env.agent.cancel();
  assert.equal(env.server.pending,null);assert.equal(env.server.cart.count,0);
  await env.agent.send('x'.repeat(4001));env.ids.mode.value='ai';await env.agent.send('DEMO-002');
  assert.equal(env.calls.filter(call=>call.url==='/api/chat').length,0);
});

test('offline mutation recovers a fresh CSRF session on the next request',async()=>{
  const env=setup();await env.ready();env.server.offline=true;await env.agent.send('DEMO-002');
  assert.equal(env.ids.send.disabled,false);
  env.server.offline=false;env.server.csrf='csrf-2';await env.agent.send('DEMO-002');
  assert.equal(env.calls.filter(call=>call.url==='/api/chat').at(-1).headers['X-CSRF-Token'],'csrf-2');
});

test('stale search results cannot replace the latest catalog',async()=>{
  const env=setup();await env.ready();let release;
  env.server.searchGate=new Promise(resolve=>release=resolve);
  env.ids.search.value='old';env.ids['search-form'].onsubmit({preventDefault(){}});
  env.ids.search.value='new';env.ids['search-form'].onsubmit({preventDefault(){}});await tick();
  release();await tick();
  const names=env.ids.products.children.flatMap(card=>card.children.filter(child=>child.tagName==='h3').map(child=>child.textContent));
  assert.deepEqual(names,['new']);
});

test('certificate URLs reject executable schemes and cart opens the existing route',async()=>{
  const previous=product.certificate_url;product.certificate_url='javascript:alert(1)';
  try{const env=setup();await env.ready();assert.equal(env.ids.products.querySelectorAll('a').length,0);await env.agent.showCart();assert.equal(env.location.destination,'/cart');}
  finally{product.certificate_url=previous;}
});
