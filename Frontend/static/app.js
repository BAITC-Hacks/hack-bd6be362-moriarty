/* EKT agent integration: same-origin FastAPI, cookie session and CSRF.
 * Catalog/stock and single-use confirmations are owned by the server.
 * Public API: window.EKTAgent; no API keys or session tokens in localStorage.
 */
(() => {
'use strict';
if (window.EKTAgent) return;
const $ = id => document.getElementById(id);
const state = {csrf:'', pending:null, busy:false, products:[], ai:false, ready:false};
let initializing;
let searchVersion = 0;
const money = value => new Intl.NumberFormat('kk-KZ').format(value) + ' ₸';
const labels = {current_a:'Ток, A',poles:'Полюстер',curve:'Сипаттама',voltage_v:'Кернеу, V',breaking_capacity_ka:'Ажырату қабілеті, kA',cores:'Өзектер',cross_section_mm2:'Қима, мм²',material:'Материал',insulation:'Оқшаулау',ip:'Қорғаныс',grounded:'Жерге тұйықтау',mount:'Орнату',power_w:'Қуат, W',base:'Цоколь',color_temperature_k:'Түс температурасы, K'};
function el(tag, cls, text) {const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n;}
function toast(text) {$('toast').textContent=text; $('toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').hidden=true,5500);}
async function api(path, options={}) {
  if (!/^https?:$/.test(location.protocol)) throw new Error('Бетті сервер арқылы ашыңыз: http://127.0.0.1:8000. file:// режимі қолдау таппайды.');
  const headers={'X-CSRF-Token':state.csrf,...options.headers};
  let body=options.body;
  if(body && !(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
  try {
    const response=await fetch(path,{...options,body,headers,credentials:'same-origin',signal:controller.signal});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('API табылмады. Бетті FastAPI серверінен ашыңыз.');
    let data; try{data=await response.json();}catch{throw new Error('Сервер жауабы оқылмады.');}
    if(!response.ok){const error=new Error(typeof data.detail==='string'?data.detail:typeof data.message==='string'?data.message:'Сұрау деректерін тексеріңіз.');error.status=response.status;throw error;}
    return data;
  } catch(error) {
    if(controller.signal.aborted)throw new Error('Жауап күту уақыты аяқталды. Әрекет орындалуы мүмкін; қайталамас бұрын себетті тексеріңіз.');
    if(error instanceof TypeError)throw new Error('Серверге қосылу мүмкін болмады. Сервер мен желіні тексеріңіз.');
    throw error;
  } finally {clearTimeout(timer);}
}
function setBusy(busy){
  state.busy=busy;
  document.querySelectorAll('#send, #mode, #attachment, #consent, [data-ekt-action]').forEach(button=>button.disabled=busy);
  $('messages').setAttribute('aria-busy',String(busy));
}
function updateMode(){
  $('consent-row').hidden=$('mode').value!=='ai';
  $('mode-description').textContent=$('mode').value==='ai'?'Құралдарды қолданатын ЖИ агент':'Каталогқа қосылған демо көмекші';
}
async function initialize(){
  if(initializing)return initializing;
  initializing=(async()=>{
    const session=await api('/api/session');
    state.csrf=session.csrf;state.ai=session.ai_available;
    updateCart(session.cart);showPending(session.pending);
    if(!state.ai)$('mode').value='demo';
    updateMode();state.ready=true;
    return session;
  })();
  try{return await initializing;}finally{initializing=null;}
}
async function mutate(handler){
  if(state.busy){toast('Алдыңғы әрекеттің аяқталуын күтіңіз.');return;}
  setBusy(true);
  try{if(!state.ready)await initialize();return await handler();}
  catch(error){
    toast(error.message);
    // Read back server state; never replay a POST after a lost response.
    state.ready=false;showPending(null);
    try{await initialize();}catch{$('mode-description').textContent='Сервер қолжетімсіз';}
  }finally{setBusy(false);}
}
function open(){
  if(location.pathname==='/cart'){location.assign('/');return;}
  document.querySelector('.chat-panel').hidden=false;
  $('open-chat').hidden=true;
  $('message').focus();
}
function close(){document.querySelector('.chat-panel').hidden=true;$('open-chat').hidden=false;$('open-chat').focus();}
function safeLink(value){try{const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}}
function action(parent,label,handler){
  const button=el('button','agent-action',label);button.type='button';button.dataset.ektAction='true';button.disabled=state.busy;
  button.onclick=()=>Promise.resolve().then(handler).catch(error=>toast(error.message));parent.append(button);
}
function addMessage(role,text){
  $('messages').querySelector('.welcome')?.remove();
  const node=el('div','message '+role); node.append(el('span','label',role==='user'?'СІЗ':role==='error'?'ХАБАРЛАМА':'EKT ASSISTANT'));
  node.append(document.createTextNode(text));
  if(text.includes('/cart')){const a=el('a','','Себетті ашу →');a.href='/cart';node.append(el('br'),a);}
  $('messages').append(node);$('messages').scrollTop=$('messages').scrollHeight;
  return node;
}
function updateCart(cart){
  $('cart-count').textContent=cart.count;$('side-count').textContent=cart.count;
  if(location.pathname!=='/cart')return;
  $('cart-items').replaceChildren();
  if(!cart.items.length)$('cart-items').append(el('div','empty-state','Себет әзірге бос. Кеңесшіден тауар таңдап, қосуды растаңыз.'));
  for(const item of cart.items){const row=el('div','cart-row'),left=el('div');left.append(el('h3','',item.product.name),el('p','',`${item.product.article} · ${item.quantity} ${item.product.unit} × ${money(item.product.price)}`));row.append(left,el('strong','',money(item.quantity*item.product.price)));$('cart-items').append(row);}
  $('cart-total').textContent=money(cart.total);
}
function showPending(proposal){
  state.pending=proposal;const root=$('proposal');root.replaceChildren();root.hidden=!proposal;if(!proposal)return;
  root.append(el('strong','','Себетке қосуды растаңыз'),el('p','',`${proposal.product.article} · ${proposal.product.name}\n${proposal.quantity} ${proposal.product.unit} × ${money(proposal.price)} = ${money(proposal.price*proposal.quantity)}`));
  const yes=el('button','','Иә, қос'),no=el('button','cancel','Бас тарту');
  yes.type=no.type='button';yes.dataset.ektAction=no.dataset.ektAction='true';yes.disabled=no.disabled=state.busy;
  yes.onclick=()=>confirm(proposal.token);no.onclick=()=>cancel(proposal.token);
  root.append(yes,no);
}
function confirm(token=state.pending?.token){
  return mutate(async()=>{
    if(!token || token!==state.pending?.token)throw new Error('Растау ескірген. Тауарды қайта таңдаңыз.');
    showPending(null);
    const cart=await api('/api/cart/confirm',{method:'POST',body:{token,accepted:true}});
    updateCart(cart);addMessage('assistant','Тауар себетке қосылды. Себетті ашу: /cart');toast('Тауар себетке қосылды');
  });
}
function cancel(token=state.pending?.token){
  return mutate(async()=>{
    if(!token || token!==state.pending?.token)throw new Error('Ұсыныс ескірген. Ағымдағы ұсынысты тексеріңіз.');
    await api('/api/cart/cancel',{method:'POST',body:{}});showPending(null);toast('Ұсыныс жойылды. Себет өзгерген жоқ.');
  });
}
async function prepareProduct(product,quantity){
  showPending(null);
  showPending(await api('/api/cart/prepare',{method:'POST',body:{product_id:product.id,quantity}}));
  open();$('proposal').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function requestAdd(article,quantity=1){
  if(typeof article!=='string'||!article.trim()||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000){toast('Артикул мен 1–10000 аралығындағы бүтін сан енгізіңіз.');return Promise.resolve();}
  return mutate(async()=>{
    const products=await api('/api/products?q='+encodeURIComponent(article.trim()));
    const product=products.find(p=>p.article.toLowerCase()===article.trim().toLowerCase());
    if(!product)throw new Error('Бұл артикул каталогта табылмады.');
    await prepareProduct(product,quantity);
  });
}
async function showCart(){
  try{if(!state.ready)await initialize();const cart=await api('/api/cart');updateCart(cart);if(location.pathname!=='/cart')location.assign('/cart');return cart;}
  catch(error){toast(error.message);}
}
function renderProducts(products){
  state.products=products;$('result-count').textContent=products.length;const root=$('products');root.replaceChildren();
  if(!products.length){root.append(el('div','empty-state','Тауар табылмады. Басқа атау немесе артикул енгізіңіз.'));return;}
  for(const p of products){
    const card=el('article','product'),amount=p.stock.reduce((sum,w)=>sum+w.quantity,0),top=el('div','product-top');
    top.append(el('span','article',p.article),el('span','stock'+(!amount?' empty':''),amount?`${amount} ${p.unit} бар`:'Қоймада жоқ'));
    const visual=el('div','product-visual'),device=el('div','device '+p.category);visual.setAttribute('aria-hidden','true');device.append(el('span','',p.category==='breaker'?'C'+p.specifications.current_a:''));visual.append(device);
    const short=Object.entries(p.specifications).slice(0,3).map(([k,v])=>`${labels[k]||k}: ${v}`).join(' · ');
    card.append(top,visual,el('div','product-brand',p.brand),el('h3','',p.name),el('div','specs',short));
    if(p.analog_reason)card.append(el('p','analog-reason',p.analog_reason));
    const price=el('div','product-price',money(p.price)+' ');price.append(el('small','',`/ ${p.unit}`));card.append(price);
    const actions=el('div','product-actions'),quantity=el('input');quantity.type='number';quantity.min='1';quantity.max=String(Math.max(amount,1));quantity.value='1';quantity.setAttribute('aria-label',p.article+' саны');
    const add=el('button','',amount?'Себетке +':'Аналог табу');
    add.type='button';add.dataset.ektAction='true';add.disabled=state.busy;
    add.onclick=()=>amount?requestAdd(p.article,Number(quantity.value)):send(`${p.article} аналогын тауып бер`);
    actions.append(quantity,add);card.append(actions);
    const details=el('details'),summary=el('summary','','Сипаттамалар және құжат');details.append(summary);
    details.append(el('p','',Object.entries(p.specifications).map(([k,v])=>`${labels[k]||k}: ${v===true?'Иә':v}`).join('\n')),el('p','',p.stock.map(w=>`${w.warehouse}: ${w.quantity} ${p.unit}`).join('\n')));
    const certificate=p.certificate_url&&safeLink(p.certificate_url);
    if(certificate){const link=el('a','','Тест сертификатын ашу ↗');link.href=certificate;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}else details.append(el('p','','Сертификат базада жоқ.'));
    card.append(details);root.append(card);
  }
}
async function loadProducts(query=''){const version=++searchVersion;try{if(!state.ready)await initialize();const products=await api('/api/products?q='+encodeURIComponent(query));if(version===searchVersion)renderProducts(products);}catch(e){if(version===searchVersion)toast(e.message);}}
async function send(text){
  if(state.busy){toast('Алдыңғы әрекеттің аяқталуын күтіңіз.');return;}
  const message=String(text??$('message').value).trim();if(!message)return;
  if(message.length>4000){toast('Хабарлама 4000 таңбадан аспауы керек.');return;}
  if($('mode').value==='ai'&&!$('consent').checked){toast('OpenAI-ға жіберу келісімін белгілеңіз.');return;}
  const file=$('attachment').files[0];if(file&&file.size>5*1024*1024){toast('Файл көлемі 5 MB-тан аспауы керек.');return;}
  const token=state.pending?.token||'';
  const mode=$('mode').value,consent=$('consent').checked;
  return mutate(async()=>{
    open();
    const data=new FormData();data.append('message',message);data.append('mode',mode);data.append('cloud_consent',String(consent));data.append('confirmation_token',token);if(file)data.append('file',file);
    showPending(null);
    addMessage('user',message+(file?`\n📎 ${file.name}`:''));$('message').value='';
    const busy=el('div','busy','Каталог деректерін тексеріп жатыр…');$('messages').append(busy);$('messages').scrollTop=$('messages').scrollHeight;
    try{
      const result=await api('/api/chat',{method:'POST',body:data});
      const reply=addMessage('assistant',result.answer);
      if(result.notice)reply.append(el('small','',result.notice));
      if(result.products?.length){
        ++searchVersion;renderProducts(result.products);
        const actions=el('div','agent-actions');
        for(const product of result.products){
          action(actions,product.article+' туралы',()=>send(product.article+' туралы ақпарат бер'));
          if(product.stock.some(warehouse=>warehouse.quantity>0)&&!result.pending)action(actions,product.article+' · 1 дана сұрау',()=>requestAdd(product.article));
        }
        reply.append(actions);
      }
      showPending(result.pending);updateCart(result.cart);
      if(result.attachment?.truncated)toast('Құжаттың алғашқы 20 000 таңбасы өңделді.');
      $('attachment').value='';$('file-info').hidden=true;
    }catch(error){addMessage('error',error.message);if(!$('message').value)$('message').value=message;throw error;}
    finally{busy.remove();$('messages').scrollTop=$('messages').scrollHeight;$('message').focus();}
  });
}
function start(){
$('messages').setAttribute('role','log');
$('open-chat').onclick=open;$('close-chat').onclick=close;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.chat-panel').contains(document.activeElement))close();});
$('chat-form').onsubmit=e=>{e.preventDefault();send();};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));
$('search-form').onsubmit=e=>{e.preventDefault();loadProducts($('search').value);};
document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));$('search').value=b.dataset.query;loadProducts(b.dataset.query);});
$('all-products').onclick=()=>{$('search').value='';loadProducts();};
$('catalog-nav').onclick=()=>{if(location.pathname==='/cart'){location.href='/#catalog-panel';return;}$('catalog-panel').scrollIntoView({behavior:'smooth'});};
$('mode').onchange=()=>{if($('mode').value==='ai'&&!state.ai){toast('ЖИ режимі үшін .env файлына API кілтін қосып, серверді қайта іске қосыңыз.');$('mode').value='demo';}updateMode();};
$('attachment').onchange=()=>{const file=$('attachment').files[0];$('file-info').replaceChildren();$('file-info').hidden=!file;if(file){$('file-info').append(document.createTextNode('📎 '+file.name));const remove=el('button','','✕');remove.type='button';remove.setAttribute('aria-label','Тіркемені алып тастау');remove.onclick=()=>{$('attachment').value='';$('file-info').hidden=true;};$('file-info').append(remove);}};
async function boot(){
  if(location.pathname==='/cart'){$('workspace').hidden=true;$('cart-page').hidden=false;}
  setBusy(true);
  try{const session=await initialize();if(location.pathname!=='/cart'){session.history.forEach(m=>addMessage(m.role,m.content));await loadProducts();}}
  catch(error){
    $('mode-description').textContent='Сервер қолжетімсіз';
    const message=addMessage('error',error.message);
    action(message,'Қайта қосылу',()=>boot());toast(error.message);
  }finally{setBusy(false);}
}
boot();
}
window.EKTAgent=Object.freeze({open,close,send,requestAdd,confirm,cancel,showCart});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
