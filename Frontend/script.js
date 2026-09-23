const products = [
    { id: 'p001', article: 'ABB-S201-C16', name: 'ABB S201 C16 автомат', category: 'Автомат', price: 4250, icon: '⚡', stock: 8, specs: 'C16 · 1P · 230V · 6kA' },
    { id: 'p002', article: 'SCH-C16-1P', name: 'Schneider Easy9 C16', category: 'Автомат', price: 3180, icon: '⚡', stock: 12, specs: 'C16 · 1P · 230V · 6kA' },
    { id: 'p003', article: 'NYM-3X2.5', name: 'Кабель NYM 3×2.5 мм²', category: 'Кабель', price: 690, icon: '〰️', stock: 145, specs: '3 жилы · 2.5 мм² · 0.66 кВ' },
    { id: 'p004', article: 'VIKO-1S-W', name: 'Viko Carmen розетка', category: 'Розетка', price: 1850, icon: '🔌', stock: 24, specs: '16A · 250V · IP20 · ақ' },
    { id: 'p005', article: 'IEK-VA47-25', name: 'IEK ВА47-29 C25', category: 'Автомат', price: 1640, icon: '⚡', stock: 0, specs: 'C25 · 1P · 230V · 4.5kA' },
    { id: 'p006', article: 'VVG-3X1.5', name: 'Кабель ВВГнг 3×1.5 мм²', category: 'Кабель', price: 430, icon: '〰️', stock: 86, specs: '3 жилы · 1.5 мм² · 0.66 кВ' }
];

const state = { category: 'Барлығы', query: '', cart: JSON.parse(localStorage.getItem('ekt-cart') || '[]'), pendingProduct: null, pendingQuantity: 1, lastProduct: null };
const $ = (selector) => document.querySelector(selector);
const formatPrice = (value) => `${new Intl.NumberFormat('kk-KZ').format(value)} ₸`;
const totalStock = (product) => product.stock;

function renderProducts() {
    const query = state.query.toLowerCase().trim();
    const visible = products.filter((product) => {
        const matchesCategory = state.category === 'Барлығы' || product.category === state.category;
        const searchable = `${product.name} ${product.article} ${product.category} ${product.specs}`.toLowerCase();
        return matchesCategory && searchable.includes(query);
    });
    $('#productCount').textContent = `${visible.length} тауар көрсетілді`;
    $('#productGrid').innerHTML = visible.length ? visible.map(productCard).join('') : '<div class="empty-state"><strong>Тауар табылмады</strong><span>Іздеу сөзін немесе санатты өзгертіп көріңіз.</span></div>';
    document.querySelectorAll('.add-to-cart').forEach((button) => button.addEventListener('click', () => openConfirm(button.dataset.id)));
}

function productCard(product) {
    const available = totalStock(product) > 0;
    return `<article class="product-card">
        <div class="product-image">${product.icon}</div>
        <span class="product-category">${product.category}</span>
        <h3>${product.name}</h3>
        <p class="article">Артикул: ${product.article}</p>
        <p class="specs">${product.specs}</p>
        <p class="stock ${available ? 'in-stock' : 'out-stock'}">${available ? `✓ Қоймада ${product.stock} дана` : '× Қоймада жоқ'}</p>
        <div class="product-bottom"><strong class="price">${formatPrice(product.price)}</strong><button class="add-to-cart" data-id="${product.id}" ${available ? '' : 'disabled'}>${available ? 'Себетке қосу' : 'Жоқ'}</button></div>
    </article>`;
}

function renderCart() {
    const items = state.cart.map((item) => ({ ...item, product: products.find((product) => product.id === item.id) })).filter((item) => item.product);
    $('#cartCount').textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    $('#cartItems').innerHTML = items.length ? items.map(({ product, quantity }) => `<div class="cart-item"><div><strong>${product.name}</strong><small>${quantity} × ${formatPrice(product.price)}</small></div><button class="remove-item" data-id="${product.id}" aria-label="Жою">×</button></div>`).join('') : '<div class="empty-cart">Себетіңіз әзірге бос.</div>';
    $('#cartTotal').textContent = formatPrice(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
    document.querySelectorAll('.remove-item').forEach((button) => button.addEventListener('click', () => removeFromCart(button.dataset.id)));
    localStorage.setItem('ekt-cart', JSON.stringify(state.cart));
}

function openModal(id) { $(id).classList.add('open'); document.body.classList.add('modal-open'); }
function closeModal(id) { $(id).classList.remove('open'); document.body.classList.remove('modal-open'); }
function openConfirm(id) { state.pendingProduct = products.find((product) => product.id === id); $('#confirmText').textContent = `${state.pendingProduct.name} тауарын себетке қосу керек пе?`; openModal('#confirmModal'); }
function requestAddToCart(product, quantity = 1) { state.pendingProduct = product; state.pendingQuantity = quantity; $('#confirmText').textContent = `${product.name} тауарынан ${quantity} дана себетке қосу керек пе?`; openModal('#confirmModal'); }
function addToCart() {
    const existing = state.cart.find((item) => item.id === state.pendingProduct.id);
    if (existing) existing.quantity += state.pendingQuantity;
    else state.cart.push({ id: state.pendingProduct.id, quantity: state.pendingQuantity });
    renderCart(); closeModal('#confirmModal');
}
function removeFromCart(id) { state.cart = state.cart.filter((item) => item.id !== id); renderCart(); }

function addMessage(text, isBot = false) {
    const message = document.createElement('div');
    message.className = `message ${isBot ? 'bot-message' : 'user-message'}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    content.appendChild(paragraph);
    message.appendChild(content);
    $('#chatMessages').appendChild(message);
    $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

function searchCatalog(query) {
    const text = query.toLowerCase();
    const tokens = text.split(/\s+/).filter((token) => token.length > 1 && !['бар', 'ма', 'керек', 'бер', 'тауып', 'маған', 'үшін'].includes(token));
    return products.filter((product) => {
        const searchable = `${product.name} ${product.article} ${product.category} ${product.specs}`.toLowerCase();
        return tokens.some((token) => searchable.includes(token)) || (text.includes('c16') && product.specs.toLowerCase().includes('c16'));
    });
}

function getRequestedQuantity(text) { const match = text.match(/\b(\d+)\s*(?:дана|шт|дн|x|х)?\b/i); return match ? Math.max(1, Number(match[1])) : 1; }

function describeProduct(product) {
    return `${product.name}: ${formatPrice(product.price)}. ${product.stock ? `Қоймада ${product.stock} дана бар.` : 'Қазір қоймада жоқ.'} Сипаттамасы: ${product.specs}.`;
}

function findAnalog(product) {
    return products.filter((item) => item.id !== product.id && item.category === product.category && item.stock > 0 && (product.category !== 'Автомат' || item.specs.includes(product.specs.split(' · ')[0]))).sort((a, b) => a.price - b.price);
}

function runAgent(question) {
    const text = question.toLowerCase();
    const quantity = getRequestedQuantity(text);
    if (text.includes('жеткізу') || text.includes('доставка')) return { text: 'Жеткізу Алматы бойынша 1-2 күнде, Қазақстан бойынша 3-7 күнде жүзеге асырылады. Тапсырыс сомасы 30 000 ₸-ден асса, жеткізу тегін.' };
    const found = searchCatalog(text)[0] || state.lastProduct;
    if (text.includes('аналог') || text.includes('ұқсас') || text.includes('арзан')) {
        const source = found || products.find((product) => product.category === 'Автомат');
        const analogs = source ? findAnalog(source) : [];
        if (!analogs.length) return { text: 'Бұл тауарға қазір қоймада қолжетімді аналог табылмады.' };
        state.lastProduct = source;
        return { text: `${source.name} үшін қолжетімді аналогтар: ${analogs.slice(0, 2).map((product) => `${product.name} — ${formatPrice(product.price)}, ${product.stock} дана`).join('; ')}.` };
    }
    if (text.includes('себет') || text.includes('қос') || text.includes('алғым') || text.includes('сатып') || text.includes('керек') || quantity > 1) {
        if (!found) return { text: 'Себетке қай тауарды қосу керек? Мысалы: «ABB C16-дан 2 дана қос».' };
        if (!found.stock) return { text: `${found.name} қоймада жоқ. Аналогын тауып берейін бе?` };
        if (quantity > found.stock) return { text: `${found.name} қоймада тек ${found.stock} дана бар, ал сіз ${quantity} дана сұрадыңыз.` };
        return { text: `${found.name} таңдалды.`, action: () => requestAddToCart(found, quantity) };
    }
    if (found) { state.lastProduct = found; return { text: describeProduct(found) }; }
    if (text.includes('автомат') || text.includes('кабель') || text.includes('розетка')) {
        const category = text.includes('кабель') ? 'Кабель' : text.includes('розетка') ? 'Розетка' : 'Автомат';
        const options = products.filter((product) => product.category === category && product.stock > 0).sort((a, b) => a.price - b.price);
        return { text: `${category} бойынша ${options.length} тауар бар. Ең қолжетімдісі: ${options[0].name} — ${formatPrice(options[0].price)}.` };
    }
    return { text: 'Мен каталог, қойма, баға, аналог және жеткізу бойынша көмектесе аламын. Мысалы: «C16 автомат бар ма?» немесе «NYM кабелінен 5 дана керек».' };
}

function sendMessage(text) {
    const value = text.trim();
    if (!value) return;
    addMessage(value); $('#chatInput').value = '';
    $('#chatStatus').textContent = 'Сұрауды талдап жатыр...';
    window.setTimeout(() => { const result = runAgent(value); addMessage(result.text, true); $('#chatStatus').textContent = 'Онлайн • Каталог дайын'; if (result.action) result.action(); }, 350);
}

document.addEventListener('DOMContentLoaded', () => {
    renderProducts(); renderCart();
    document.querySelectorAll('.category').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; document.querySelectorAll('.category').forEach((item) => item.classList.toggle('active', item === button)); renderProducts(); }));
    $('#searchButton').addEventListener('click', () => { state.query = $('#searchInput').value; renderProducts(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); });
    $('#searchInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#searchButton').click(); });
    $('#cartButton').addEventListener('click', () => openModal('#cartModal')); $('#closeCart').addEventListener('click', () => closeModal('#cartModal'));
    $('#cancelAdd').addEventListener('click', () => closeModal('#confirmModal')); $('#confirmAdd').addEventListener('click', addToCart);
    $('#heroChatButton').addEventListener('click', () => { $('#chatWindow').classList.add('open'); $('#chatInput').focus(); }); $('#openChatButton').addEventListener('click', () => $('#floatingChat').click()); $('#floatingChat').addEventListener('click', () => $('#chatWindow').classList.toggle('open')); $('#closeChat').addEventListener('click', () => $('#chatWindow').classList.remove('open'));
    $('#sendMessage').addEventListener('click', () => sendMessage($('#chatInput').value)); $('#chatInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') sendMessage($('#chatInput').value); });
    document.querySelectorAll('.quick-questions button').forEach((button) => button.addEventListener('click', () => sendMessage(button.textContent)));
    document.querySelectorAll('.modal-overlay').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(`#${modal.id}`); }));
    document.querySelector('.checkout-button').addEventListener('click', () => alert(state.cart.length ? 'Рақмет! Тапсырысыңыз қабылданды. Менеджер сізбен байланысады.' : 'Алдымен себетке тауар қосыңыз.'));
});