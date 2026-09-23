import type { AnalogExplanation, Availability, CartLine, ChatResponse, Estimate, Freshness, Intent, PendingAction, Product, SpecificationRow } from "../../shared/types.ts";
import type { AuditEvent, BackendTools, ChatInput, FileExtractor, IntentPlan, IntentPlanner, ReadContext } from "./contracts.ts";
import { extractRows, isSuspiciousFileText, validateRows } from "./files.ts";
import { detectLanguage, localIntent, normalized, parseConfirmation, productQuery, requestedQuantity } from "./intent.ts";
import { validatePlan } from "./planner.ts";
import { compareProducts, explainAnalog, freshText, knownNumber, money, productText, safeUrl, say, validQuantity, warningText } from "./reasoning.ts";
import { MemorySessionStore } from "./session.ts";
import type { SessionState, SessionStore } from "./session.ts";

type Reply = Partial<ChatResponse> & { message: string };
export interface AgentOptions {
  tools: BackendTools;
  sessions?: SessionStore;
  planner?: IntentPlanner;
  extractor?: FileExtractor;
  now?: () => number;
  confirmationTtlMs?: number;
  staleAfterMs?: number;
  audit?: (event: AuditEvent) => void;
}
function context(s: SessionState, fresh = false): ReadContext { return { sessionId: s.sessionId, fresh }; }
function canonicalStore(value: string): string {
  return normalized(value).replace(/нур[ -]султан|нұр[ -]сұлтан/g, "астана");
}
function availableAt(stock: Availability, storeName: string | null): { quantity: number | null; storeId?: number } {
  if (!storeName) return { quantity: knownNumber(stock.total) ? stock.total : null };
  const stores = stock.stores.filter(store => canonicalStore(store.name) === canonicalStore(storeName));
  if (stores.length !== 1) return { quantity: null };
  return { quantity: knownNumber(stores[0]!.quantity) ? stores[0]!.quantity : null, storeId: stores[0]!.id };
}
function uniqueMetadata(metadata: Freshness[]): Freshness[] {
  return metadata.filter((m, index) => (m.fetchedAt || m.source === "file") && m.source && metadata.findIndex(x => x.fetchedAt === m.fetchedAt && x.source === m.source && x.sourceName === m.sourceName) === index)
    .map(m => ({ source: m.source, fetchedAt: m.fetchedAt, sourceName: m.sourceName, importedAt: m.importedAt }));
}
function priceTotal(items: CartLine[]): number { return Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100; }

export class EktAgent {
  private readonly tools: BackendTools;
  private readonly sessions: SessionStore;
  private readonly options: AgentOptions;
  private readonly now: () => number;
  constructor(options: AgentOptions) {
    this.options = options;
    this.tools = options.tools;
    this.now = options.now ?? Date.now;
    this.sessions = options.sessions ?? new MemorySessionStore({ now: this.now });
  }
  private audit(event: AuditEvent): void {
    // Diagnostics cannot break transaction handling; raw user/file content is never logged.
    try { this.options.audit?.(event); } catch { /* isolated diagnostics */ }
  }
  async chat(input: ChatInput): Promise<ChatResponse> {
    return this.sessions.withSession(input.sessionId, async s => {
      let intent: Intent = "UNKNOWN";
      let reply: Reply;
      try {
        const text = input.text ?? "";
        if (typeof text !== "string" || text.length > 4000 || (input.attachments?.length ?? 0) > 5 || (input.language && !["kk", "ru"].includes(input.language))) {
          reply = { message: say(s.language, "Сұраныс пішімі жарамсыз.", "Неверный формат запроса."), error: "INVALID_INPUT" };
        } else {
          s.language = input.language ?? detectLanguage(text, s.language);
          // Do not persist text, card data, file bytes, credentials or model transcripts.
          if (/cvv|cvc|номер карты|карта нөмір|төлем жаса|оплати|process payment|card number|payment credentials/i.test(text) || (/(?:\d[ -]?){13,19}/.test(text) && /карт|card|visa|mastercard/i.test(text))) {
            s.pendingAction = null;
            reply = { message: say(s.language, "Төлемді ресми сайттағы тапсырысты рәсімдеу бетінде орындаңыз. Карта деректерін чатқа жібермеңіз.", "Оплатите заказ через оформление на официальном сайте. Не отправляйте данные карты в чат.") };
          } else if (s.uncertainActionId) {
            reply = await this.reconcile(s);
          } else if (input.attachments?.length) {
            s.pendingAction = null;
            intent = input.attachments.some(f => /pdf|excel|spreadsheet/.test(f.mimeType)) || /специфика|тізім|список/.test(text) ? "SPEC_FILE_ESTIMATE" : "FILE_PRODUCT_SEARCH";
            reply = await this.files(input, s, intent);
          } else {
            const decision = input.confirmation?.decision ?? parseConfirmation(text);
            if (input.confirmation && !["confirm", "cancel"].includes(input.confirmation.decision)) throw new Error("Invalid confirmation");
            if (input.confirmation && text.trim() && parseConfirmation(text) !== input.confirmation.decision) {
              s.pendingAction = null;
              reply = { message: say(s.language, "Растау мен мәтін сәйкес емес. Ұсынысты қайта сұраңыз.", "Подтверждение и текст противоречат друг другу. Запросите предложение заново."), error: "INVALID_INPUT" };
            } else if (decision) {
              intent = "ADD_TO_CART_CONFIRMATION";
              const pending = s.pendingAction;
              if (!pending || (input.confirmation && input.confirmation.actionId !== pending.actionId)) {
                reply = { message: say(s.language, "Осы растауға сәйкес күтіп тұрған әрекет жоқ. Тауар мен санын таңдаңыз.", "Нет ожидающего действия для этого подтверждения. Выберите товар и количество.") };
              } else if (decision === "cancel") {
                s.pendingAction = null;
                reply = { message: say(s.language, "Себетке қосу тоқтатылды.", "Добавление в корзину отменено.") };
              } else if (input.selectedProductId !== undefined && input.selectedProductId !== s.selectedProductId) {
                s.pendingAction = null;
                reply = { message: say(s.language, "Таңдау өзгерді. Тауар мен санын қайта растаңыз.", "Выбор изменился. Заново укажите товар и количество.") };
              } else {
                reply = await this.confirm(s, pending);
              }
            } else {
              // An intervening turn always invalidates the old offer, including unrelated questions.
              s.pendingAction = null;
              const selected = this.selectFromInput(input, s);
              if (selected === false) reply = { message: say(s.language, "Тізімде көрсетілген тауарды таңдаңыз.", "Выберите товар из показанного списка.") };
              else {
                let plan = localIntent(text);
                if (this.options.planner && !selected) {
                  try {
                    const proposed = validatePlan(await this.options.planner.plan({ text, language: s.language, selectedProductId: s.selectedProductId, recentProductIds: [...s.recentProductIds] }));
                    // Model output never constitutes confirmation or file extraction.
                    if (!["ADD_TO_CART_CONFIRMATION", "FILE_PRODUCT_SEARCH", "SPEC_FILE_ESTIMATE"].includes(proposed.intent)) plan = proposed;
                  } catch { this.audit({ event: "planner_error", sessionId: s.sessionId }); }
                }
                if (selected && !text.trim()) plan = { intent: "PRODUCT_INFO" };
                if (plan.productIds?.some(id => !s.recentProductIds.includes(id))) {
                  reply = { message: say(s.language, "Алдымен каталогтан тауарды таңдаңыз.", "Сначала выберите товар из каталога.") };
                } else {
                  intent = plan.intent;
                  reply = await this.dispatch(plan, text, s, Boolean(selected));
                }
              }
            }
          }
        }
      } catch {
        this.audit({ event: "backend_error", sessionId: s.sessionId });
        s.pendingAction = null;
        reply = { message: say(s.language, "Дерек көзінен жауап алу мүмкін болмады. Кейінірек қайталап көріңіз.", "Не удалось получить ответ источника данных. Повторите позже."), error: "BACKEND_UNAVAILABLE" };
      }
      return this.finish(s, intent, reply);
    });
  }
  private finish(s: SessionState, intent: Intent, reply: Reply): ChatResponse {
    const products = reply.products ?? [];
    s.lastShownProductIds = products.map(p => p.id);
    const warnings = [...(reply.warnings ?? []), ...products.flatMap(p => p.dataQualityWarnings ?? [])];
    const distinctWarnings = warnings.filter((w, i) => warnings.findIndex(v => JSON.stringify(v) === JSON.stringify(w)) === i);
    const freshness = uniqueMetadata([...(reply.freshness ?? []), ...products]);
    const metaText = freshness.map(m => freshText(m, s.language, this.now(), this.options.staleAfterMs ?? 15 * 60000)).filter(Boolean).join("\n");
    let message = reply.message;
    if (distinctWarnings.length && !distinctWarnings.every(w => message.includes(w.message))) message += "\n" + warningText(distinctWarnings, s.language);
    if (metaText) message += "\n" + metaText;
    const messageId = crypto.randomUUID();
    s.messageIds = [...s.messageIds.slice(-199), messageId];
    // Return snapshots: frontend code cannot mutate live server session state.
    return structuredClone({ ...reply, messageId, intent, message, products, warnings: distinctWarnings,
      pendingAction: s.pendingAction, cart: reply.cart ?? null, freshness });
  }
  private remember(s: SessionState, products: Product[]): void {
    s.recentProductIds = [...new Set([...products.map(p => p.id), ...s.recentProductIds])].slice(0, 30);
  }
  private selectFromInput(input: ChatInput, s: SessionState): boolean | undefined {
    let id = input.selectedProductId;
    const text = normalized(input.text ?? "");
    if (id === undefined && /бастапқы|первоначальн|исходный/.test(text)) id = s.originalProductId ?? undefined;
    if (id === undefined) {
      const position = ["бірінші", "екінші", "үшінші", "первый", "второй", "третий"].indexOf(text);
      const n = position >= 0 ? position % 3 : /^[1-3]$/.test(text) ? Number(text) - 1 : -1;
      if (n >= 0) {
        id = s.lastShownProductIds[n];
        if (id === undefined) return false;
      }
    }
    if (id === undefined) return undefined;
    if (!s.recentProductIds.includes(id)) return false;
    s.selectedProductId = id;
    return true;
  }
  private async dispatch(plan: IntentPlan, text: string, s: SessionState, selected: boolean): Promise<Reply> {
    if (plan.intent === "UNKNOWN") return { message: say(s.language, "Тауардың атауын, артикулын немесе қажетті сипаттамаларын жазыңыз.", "Напишите название, артикул или нужные характеристики товара.") };
    if (plan.intent === "PURCHASE_TERMS") {
      const terms = await this.tools.get_purchase_terms(context(s));
      if (!terms.approved || !safeUrl(terms.sourceUrl)) return { message: say(s.language, "Қосылған дерек көзінде ресми сатып алу шарттары жоқ.", "В подключённом источнике официальные условия покупки недоступны.") };
      const lines = [["Төлем", "Оплата", terms.payment], ["Жеткізу", "Доставка", terms.delivery], ["Ең аз партия", "Минимальная партия", terms.minimumOrder]];
      return { message: lines.map(([kk, ru, value]) => `${say(s.language, kk!, ru!)}: ${value || say(s.language, "дерек жоқ", "нет данных")}`).join("\n") + `\n${safeUrl(terms.sourceUrl)}`, freshness: [terms] };
    }
    if (plan.intent === "PRODUCT_COMPARE") {
      let ids = plan.productIds;
      if (!ids) {
        const references = [...new Set((text.match(/[\p{L}\d_.-]+/gu) ?? []).filter(token => /\d/.test(token) && token.length >= 4))].slice(0, 3);
        if (references.length >= 2) {
          ids = [];
          for (const reference of references) {
            const result = await this.resolveSearch(reference, s);
            if ("message" in result) return result;
            ids.push(result.id);
          }
        } else ids = s.recentProductIds.slice(0, 3);
      }
      ids = [...new Set(ids)];
      if (ids.length < 2) return { message: say(s.language, "Салыстыру үшін кемінде екі тауарды іздеп таңдаңыз.", "Найдите и выберите минимум два товара для сравнения.") };
      const products = await Promise.all(ids.map(id => this.detail(id, s)));
      return { message: compareProducts(products, s.language), products };
    }
    if (plan.store) s.storeName = plan.store;
    if (/барлық қойма|жалпы қалдық|все склады|общий остаток/i.test(text)) s.storeName = null;
    const query = plan.query ?? productQuery(text);
    const isFollowup = !query || /^(осы|оның|осының|бұл|осыны|этот|его|этого|сколько будет|қанша болады|аналог|балама|аналог көрсет|покажи аналог|қалдық|остаток|бар)$/i.test(query);
    let id = plan.productIds?.[0] ?? s.selectedProductId;
    if (plan.intent === "PRODUCT_SEARCH" && !selected) return this.search(plan.query ?? text, s);
    // Concrete article/model in a follow-up must resolve a new product, not reuse a stale selection.
    const newIdentifier = /[a-z]+[-\d]*|\d{4,}/i.test(query) && !/^(шт|дана)$/i.test(query);
    if (!id || (!selected && !isFollowup && newIdentifier)) {
      if (!query || isFollowup) return { message: say(s.language, "Алдымен тауарды таңдаңыз немесе артикулын жазыңыз.", "Сначала выберите товар или напишите артикул.") };
      const result = await this.resolveSearch(query, s);
      if ("message" in result) return result;
      id = result.id;
    }
    const product = await this.detail(id, s);
    s.selectedProductId = product.id;
    if (!s.originalProductId) s.originalProductId = product.id;
    this.remember(s, [product]);
    switch (plan.intent) {
      case "ADD_TO_CART_REQUEST": {
        const quantity = requestedQuantity(text) ?? plan.quantity;
        if (!validQuantity(quantity)) return { message: say(s.language, "Қанша дана керек? Оң бүтін сан жазыңыз.", "Сколько штук нужно? Укажите положительное целое число."), products: [product] };
        return this.propose(s, [{ productId: id, quantity }]);
      }
      case "ANALOG_SEARCH": return this.analogs(product, s);
      case "STOCK_CHECK": case "STORE_STOCK_CHECK": {
        const stock = await this.tools.get_availability(id, context(s));
        const { quantity } = availableAt(stock, s.storeName);
        const label = s.storeName ?? say(s.language, "Барлық қойма", "Все склады");
        const message = quantity === null ? say(s.language, `${label}: қалдық туралы дерек жоқ.`, `${label}: нет данных об остатке.`) : say(s.language, `${label}: ${quantity} дана.`, `${label}: ${quantity} шт.`);
        if (quantity === 0) {
          const analogs = await this.analogs(product, s);
          return { ...analogs, message: message + "\n" + analogs.message, freshness: [stock, ...(analogs.freshness ?? [])] };
        }
        return { message, products: [product], freshness: [stock] };
      }
      case "PRICE_CHECK": return { message: productText(product, s.language), products: [product] };
      default: return { message: productText(product, s.language, true), products: [product] };
    }
  }
  private async detail(id: number, s: SessionState, fresh = false): Promise<Product> {
    const p = await this.tools.get_product_detail(id, context(s, fresh));
    if (!p || p.id !== id || !p.name || (p.price !== null && !knownNumber(p.price))) throw new Error("Invalid product detail");
    return p;
  }
  private async resolveSearch(query: string, s: SessionState): Promise<Product | Reply> {
    s.lastSearch = query;
    const result = await this.tools.search_products(query, context(s));
    const products = result.items.slice(0, 3);
    this.remember(s, products);
    const exact = result.items.filter(p => [String(p.id), p.article, p.supplierArticle].some(v => v && normalized(v) === normalized(query)));
    const strong = result.exactMatchId ? result.items.find(p => p.id === result.exactMatchId) : exact.length === 1 ? exact[0] : undefined;
    if (strong) { s.selectedProductId = strong.id; s.originalProductId = strong.id; this.remember(s, [strong]); return strong; }
    s.selectedProductId = null;
    s.originalProductId = null;
    return {
      message: products.length ? products.map((p, i) => `${i + 1}. ${productText(p, s.language)}`).join("\n\n") + "\n" + say(s.language, "Сәйкестікті нақтылау үшін тауарды таңдаңыз.", "Выберите товар, чтобы уточнить соответствие.") : say(s.language, "Каталогта сенімді сәйкестік табылмады. Артикулды немесе сипаттаманы нақтылаңыз.", "Надёжное совпадение в каталоге не найдено. Уточните артикул или характеристики."),
      products, freshness: [result],
    };
  }
  private async search(query: string, s: SessionState): Promise<Reply> {
    const found = await this.resolveSearch(query, s);
    if ("message" in found) return found;
    const product = await this.detail(found.id, s);
    const stock = await this.tools.get_availability(product.id, context(s));
    const { quantity } = availableAt(stock, s.storeName);
    const summary = productText(product, s.language, true) + "\n" + (quantity === null ? say(s.language, "Қалдық белгісіз.", "Остаток неизвестен.") : say(s.language, `Қалдық: ${quantity} дана.`, `Остаток: ${quantity} шт.`));
    if (quantity === 0) {
      const analogs = await this.analogs(product, s);
      return { ...analogs, message: summary + "\n" + analogs.message, freshness: [stock, ...(analogs.freshness ?? [])] };
    }
    return { message: summary, products: [product], freshness: [stock] };
  }
  private async analogs(product: Product, s: SessionState): Promise<Reply> {
    const candidates = await this.tools.get_analog_candidates(product.id, context(s));
    const products: Product[] = [], analogs: AnalogExplanation[] = [], freshness: Freshness[] = [];
    for (const candidate of candidates.filter(p => p.id !== product.id).slice(0, 10)) {
      const detail = await this.detail(candidate.id, s);
      const stock = await this.tools.get_availability(detail.id, context(s));
      const qty = availableAt(stock, s.storeName).quantity;
      if (qty === null || qty <= 0 || stock.available === false) continue;
      products.push(detail);
      freshness.push(stock);
      analogs.push(explainAnalog(product, detail, s.language));
      if (products.length === 3) break;
    }
    this.remember(s, products);
    return { message: analogs.length ? analogs.map(a => a.message + "\n" + productText(a.product, s.language)).join("\n\n") : say(s.language, "Қолжетімді әрі расталған аналог табылмады. Сипаттаманы менеджермен нақтылаңыз.", "Доступный подтверждённый аналог не найден. Уточните характеристики у менеджера."), products, analogs, warnings: product.dataQualityWarnings ?? [], freshness };
  }
  private makePending(s: SessionState, items: CartLine[]): PendingAction {
    const pending: PendingAction = {
      type: items.length === 1 ? "ADD_TO_CART" : "ADD_MANY_TO_CART",
      actionId: crypto.randomUUID(), items, total: priceTotal(items),
      expiresAt: new Date(this.now() + (this.options.confirmationTtlMs ?? 5 * 60000)).toISOString(),
    };
    if (items.length === 1) { pending.productId = items[0]!.productId; pending.quantity = items[0]!.quantity; }
    s.pendingAction = pending;
    return pending;
  }
  private offerText(s: SessionState, pending: PendingAction, products: Product[]): string {
    const lines = pending.items.map(item => `${products.find(p => p.id === item.productId)?.name ?? item.productId}: ${item.quantity} × ${money(item.unitPrice, s.language)} = ${money(item.quantity * item.unitPrice, s.language)}`);
    return (s.storeName ? say(s.language, `Қойма: ${s.storeName}\n`, `Склад: ${s.storeName}\n`) : "") + lines.join("\n") + "\n" + say(s.language, `Жалпы: ${money(pending.total, s.language)}. Корзинаға қосайын ба?`, `Итого: ${money(pending.total, s.language)}. Добавить в корзину?`);
  }
  private async propose(s: SessionState, requested: { productId: number; quantity: number }[]): Promise<Reply> {
    const aggregate = new Map<number, number>();
    for (const item of requested) {
      const quantity = (aggregate.get(item.productId) ?? 0) + item.quantity;
      if (!validQuantity(quantity)) throw new Error("Invalid quantity");
      aggregate.set(item.productId, quantity);
    }
    const items: CartLine[] = [], products: Product[] = [], freshness: Freshness[] = [];
    let reduced = false;
    for (const [id, desired] of aggregate) {
      const p = await this.detail(id, s, true);
      const stock = await this.tools.get_availability(id, context(s, true));
      products.push(p); freshness.push(stock);
      const available = availableAt(stock, s.storeName);
      if (available.quantity !== null && available.quantity < 1) {
        const analogs = await this.analogs(p, s);
        return { ...analogs, message: say(s.language, "Тауар қолжетімсіз.\n", "Товар недоступен.\n") + analogs.message };
      }
      if (available.quantity === null || !knownNumber(p.price) || stock.available !== true) return { message: say(s.language, "Баға немесе қолжетімді қалдық расталмаған. Себетке қосу ұсынысы жасалмады.", "Цена или доступный остаток не подтверждены. Предложение добавления не создано."), products, freshness };
      const quantity = Math.min(desired, Math.floor(available.quantity));
      if (quantity !== desired) reduced = true;
      items.push({ productId: id, quantity, unitPrice: p.price, ...(available.storeId !== undefined ? { storeId: available.storeId } : {}) });
    }
    const pending = this.makePending(s, items);
    return { message: (reduced ? say(s.language, "Сұралған сан жеткіліксіз. Қазір қолжетімді саны бойынша ұсыныс:\n", "Запрошенного количества недостаточно. Предложение по доступному количеству:\n") : "") + this.offerText(s, pending, products), products, freshness };
  }
  private async confirm(s: SessionState, pending: PendingAction): Promise<Reply> {
    if (Date.parse(pending.expiresAt) <= this.now()) {
      s.pendingAction = null;
      return { message: say(s.language, "Растау мерзімі аяқталды. Саны мен бағасын қайта тексерейік.", "Срок подтверждения истёк. Снова проверьте количество и цену.") };
    }
    const products: Product[] = [], freshness: Freshness[] = [];
    let changed = false;
    for (const item of pending.items) {
      const p = await this.detail(item.productId, s, true);
      const stock = await this.tools.get_availability(item.productId, context(s, true));
      products.push(p); freshness.push(stock);
      const qty = item.storeId !== undefined ? stock.stores.find(store => store.id === item.storeId)?.quantity : stock.total;
      if (["cache", "file"].includes(p.source ?? "") || ["cache", "file"].includes(stock.source ?? "") || !knownNumber(qty) || !knownNumber(p.price) || stock.available !== true) {
        s.pendingAction = null;
        return { message: say(s.language, "Ағымдағы баға мен қалдық расталмады. Себет өзгертілмеді.", "Текущие цена и остаток не подтверждены. Корзина не изменена."), products, freshness };
      }
      if (p.price !== item.unitPrice || qty < item.quantity) changed = true;
    }
    if (changed) {
      s.pendingAction = null;
      const renewed = await this.propose(s, pending.items);
      return { ...renewed, message: say(s.language, "Баға немесе қалдық өзгерді. Жаңартылған ұсынысты қайта растаңыз.\n", "Цена или остаток изменились. Подтвердите обновлённое предложение.\n") + renewed.message };
    }
    const mutationContext = { sessionId: s.sessionId, confirmed: true as const, idempotencyKey: pending.actionId, expectedLines: structuredClone(pending.items) };
    // Consume confirmation before the mutation. Unknown outcomes block all later mutations.
    s.pendingAction = null;
    s.uncertainActionId = pending.actionId;
    try {
      const result = pending.items.length === 1
        ? await this.tools.add_to_cart(pending.items[0]!.productId, pending.items[0]!.quantity, true, mutationContext)
        : await this.tools.add_many_to_cart(structuredClone(pending.items), mutationContext);
      if (!result || typeof result.success !== "boolean") throw new Error("Invalid mutation response");
      s.uncertainActionId = null;
      return { ...this.cartReply(result, s), products, freshness };
    } catch {
      this.audit({ event: "backend_error", sessionId: s.sessionId });
      return { message: say(s.language, "Себет әрекетінің нәтижесі белгісіз. Қайта қоспас бұрын серверден мәртебесін тексеремін.", "Результат операции с корзиной неизвестен. Перед повторным добавлением проверю её статус."), error: "CART_OUTCOME_UNKNOWN" };
    }
  }
  private cartReply(result: NonNullable<ChatResponse["cart"]>, s: SessionState): Reply {
    const cart = { ...result, cartUrl: safeUrl(result.cartUrl) };
    let message = result.success ? say(s.language, "Тауарлар корзинаға қосылды.", "Товары добавлены в корзину.") : say(s.language, "Сервер себетке қосуды қабылдамады. Жаңа ұсыныс сұраңыз.", "Сервер отклонил добавление. Запросите новое предложение.");
    if (result.mocked) message = say(s.language, "Демо себет: ", "Демо-корзина: ") + message;
    if (result.success) message += cart.cartUrl ? `\n${say(s.language, "Корзинаға өту", "Перейти в корзину")}: ${cart.cartUrl}` : "\n" + say(s.language, "Сервер себет сілтемесін бермеді.", "Сервер не предоставил ссылку на корзину.");
    return { message, cart };
  }
  private async reconcile(s: SessionState): Promise<Reply> {
    const status = await this.tools.get_cart_action_status(s.uncertainActionId!, context(s, true));
    if (status.status === "succeeded") { s.uncertainActionId = null; return this.cartReply(status.result, s); }
    if (status.status === "not_applied") {
      s.uncertainActionId = null;
      return { message: say(s.language, "Сервер алдыңғы әрекет орындалмағанын растады. Жаңа ұсыныс сұрауға болады.", "Сервер подтвердил, что операция не была выполнена. Можно запросить новое предложение.") };
    }
    return { message: say(s.language, "Алдыңғы себет әрекетінің мәртебесі әлі белгісіз. Қайта қосу тоқтатылды.", "Статус предыдущей операции всё ещё неизвестен. Повторное добавление заблокировано."), error: "CART_OUTCOME_UNKNOWN" };
  }
  private async files(input: ChatInput, s: SessionState, intent: Intent): Promise<Reply> {
    let rows: SpecificationRow[];
    try {
      rows = validateRows((await Promise.all(input.attachments!.map(f => extractRows(f, this.options.extractor)))).flat());
    } catch {
      return { message: say(s.language, "Файлдан тауар тізімін сенімді шығару мүмкін болмады. Мәтін не «тауар; саны» жолдарын жіберіңіз.", "Не удалось надёжно извлечь товары из файла. Отправьте текст или строки «товар; количество»."), error: "EXTRACTION_FAILED" };
    }
    if (rows.some(row => isSuspiciousFileText(row.query))) this.audit({ event: "suspicious content in file", sessionId: s.sessionId });
    if (intent === "FILE_PRODUCT_SEARCH" && rows.length === 1) return this.search(rows[0]!.query, s);
    const result = await this.tools.matchSpecification(rows, context(s));
    if (!Array.isArray(result.rows) || result.rows.length !== rows.length) throw new Error("Incomplete specification response");
    let total = 0, found = 0, incompleteTotal = false;
    const explanations: AnalogExplanation[] = [];
    const products: Product[] = [];
    const requested: { productId: number; quantity: number }[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = result.rows[index]!, inputRow = rows[index]!;
      if (row.inputQuery !== inputRow.query || row.requestedQty !== inputRow.requestedQty || !["found", "not_found", "analog_suggested"].includes(row.status)) throw new Error("Invalid specification match");
      if (row.status === "found") {
        if (!row.matchedProduct) throw new Error("Missing matched product");
        found++;
        products.push(row.matchedProduct);
        requested.push({ productId: row.matchedProduct.id, quantity: row.requestedQty });
        if (!knownNumber(row.unitPrice)) {
          incompleteTotal = true;
          if (row.lineTotal !== null) throw new Error("Line total without price");
        } else {
          const expected = Math.round(row.unitPrice * row.requestedQty * 100) / 100;
          if (!knownNumber(row.lineTotal) || Math.abs(expected - row.lineTotal) > 0.005) throw new Error("Invalid line total");
          total += row.lineTotal;
        }
      } else if (row.status === "analog_suggested") {
        if (!row.analog) throw new Error("Missing analog");
        explanations.push(explainAnalog(null, row.analog, s.language));
        products.push(row.analog);
      }
    }
    total = Math.round(total * 100) / 100;
    if (result.totalFound !== found || result.totalMissing !== rows.length - found || (!incompleteTotal && (!knownNumber(result.grandTotal) || Math.abs(result.grandTotal - total) > 0.005))) throw new Error("Invalid estimate aggregate");
    const estimate: Estimate = { ...result, grandTotal: incompleteTotal ? null : total, incompleteTotal, explanations };
    this.remember(s, products);
    const labels = { found: say(s.language, "Табылды", "Найдено"), not_found: say(s.language, "Табылмады", "Не найдено"), analog_suggested: say(s.language, "Аналог ұсынылды", "Предложен аналог") };
    let message = result.rows.map(row => `${row.inputQuery}: ${labels[row.status]}${row.status === "found" ? ` — ${row.matchedProduct!.name}, ${row.requestedQty} × ${knownNumber(row.unitPrice) ? money(row.unitPrice, s.language) : say(s.language, "баға белгісіз", "цена неизвестна")}` : ""}`).join("\n");
    message += "\n" + (incompleteTotal ? say(s.language, "Жалпы сома толық емес: кейбір бағалар белгісіз.", "Полная сумма неизвестна: отсутствуют некоторые цены.") : say(s.language, `Табылған тауарлардың жалпы сомасы: ${money(total, s.language)}.`, `Общая сумма найденных товаров: ${money(total, s.language)}.`));
    if (explanations.length) message += "\n" + explanations.map(e => e.message).join("\n\n");
    let proposal: Reply | undefined;
    if (requested.length) {
      proposal = await this.propose(s, requested);
      message += "\n\n" + proposal.message;
    }
    return { message, products, estimate, analogs: explanations, freshness: [result, ...(proposal?.freshness ?? []), ...(proposal?.products ?? [])], warnings: proposal?.products?.flatMap(p => p.dataQualityWarnings ?? []) };
  }
  async recordFeedback(sessionId: string, messageId: string, rating: "up" | "down"): Promise<void> {
    return this.sessions.withSession(sessionId, async s => {
      if (!["up", "down"].includes(rating) || !s.messageIds.includes(messageId)) throw new Error("Invalid or foreign feedback");
      await this.tools.recordFeedback(messageId, rating, context(s));
    });
  }
}
