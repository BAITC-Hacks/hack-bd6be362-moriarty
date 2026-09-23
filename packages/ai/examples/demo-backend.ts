import type { BackendTools, MutationContext } from "../src/contracts.ts";
import type { Availability, CartLine, CartResult, Product, SpecificationResult } from "../../shared/types.ts";

/** Synthetic test data only. These are NOT current EKT prices or stock. */
export function createDemoBackend(now = () => Date.now()) {
  const metadata = () => ({ source: "ekt_api" as const, fetchedAt: new Date(now()).toISOString() });
  const properties = { category: "circuit_breaker", voltage: "400 V", nominal_current: "160 A", poles: "3", breaking_capacity: "18 kA" };
  const products: Product[] = [
    { id: 515291, name: "DEMO DRX250 3P 160A 18kA Legrand", article: "200300285_", supplierArticle: "027228", price: 64920, quantity: 23, brand: "Legrand", properties, certificates: [], ...metadata() },
    { id: 515292, name: "DEMO DRX250 3P 160A 25kA Legrand", article: "200300286_", supplierArticle: "027229", price: 71000, quantity: 10, brand: "Legrand", properties: { ...properties, breaking_capacity: "25 kA" }, certificates: [], ...metadata() },
    { id: 515293, name: "DEMO ABB 3P 160A", article: "ABB160", price: 72000, quantity: 12, brand: "ABB", properties: { ...properties }, certificates: [], ...metadata() },
  ];
  const stocks = new Map<number, Availability>(products.map(p => [p.id, {
    total: p.quantity!, available: true, stores: [{ id: 1, name: "Алматы", quantity: p.id === 515291 ? 5 : 10 }, { id: 2, name: "Нур-Султан", quantity: 8 }], ...metadata(),
  }]));
  const calls: { name: string; args: unknown[] }[] = [];
  const actions = new Map<string, CartResult>();
  const record = (name: string, ...args: unknown[]) => { calls.push({ name, args: structuredClone(args) }); };
  function mutate(items: CartLine[], ctx: MutationContext): CartResult {
    const key = `${ctx.sessionId}:${ctx.idempotencyKey}`;
    if (actions.has(key)) return actions.get(key)!;
    if (!ctx.confirmed || items.some(item => {
      const stock = stocks.get(item.productId)!;
      const qty = item.storeId === undefined ? stock.total : stock.stores.find(s => s.id === item.storeId)?.quantity;
      return !qty || qty < item.quantity || products.find(p => p.id === item.productId)?.price !== item.unitPrice;
    })) return { success: false, mocked: true };
    for (const item of items) {
      const stock = stocks.get(item.productId)!;
      stock.total! -= item.quantity;
      if (item.storeId !== undefined) stock.stores.find(s => s.id === item.storeId)!.quantity! -= item.quantity;
    }
    const result = { success: true, mocked: true, cartUrl: "https://demo.invalid/cart" };
    actions.set(key, result);
    return result;
  }
  const tools: BackendTools = {
    async search_products(query, ctx) {
      record("search_products", query, ctx);
      const exact = products.find(p => [p.article, p.supplierArticle, String(p.id)].some(a => a?.toLowerCase() === query.trim().toLowerCase()));
      const items = exact ? [exact] : products.filter(p => query.toLowerCase().split(/\s+/).filter(Boolean).every(part => `${p.name} ${p.article} ${p.supplierArticle}`.toLowerCase().includes(part)));
      return structuredClone({ items, ...(exact ? { exactMatchId: exact.id } : {}), ...metadata() });
    },
    async get_product_detail(id, ctx) { record("get_product_detail", id, ctx); const p = products.find(p => p.id === id); if (!p) throw new Error("Missing demo product"); return structuredClone(p); },
    async get_availability(id, ctx) { record("get_availability", id, ctx); return structuredClone(stocks.get(id)!); },
    async get_analog_candidates(id, ctx) { record("get_analog_candidates", id, ctx); return structuredClone(products.filter(p => p.id !== id)); },
    async get_purchase_terms(ctx) { record("get_purchase_terms", ctx); return { approved: false }; },
    async matchSpecification(rows, ctx) {
      record("matchSpecification", rows, ctx);
      const result: SpecificationResult = { rows: [], totalFound: 0, totalMissing: 0, grandTotal: 0, ...metadata() };
      for (const row of rows) {
        const p = products.find(p => p.article === row.query || p.supplierArticle === row.query);
        result.rows.push({ inputQuery: row.query, requestedQty: row.requestedQty, matchedProduct: p ? structuredClone(p) : null, status: p ? "found" : "not_found", analog: null, availableQty: p?.quantity ?? null, unitPrice: p?.price ?? null, lineTotal: p?.price != null ? p.price * row.requestedQty : null });
        if (p) { result.totalFound++; result.grandTotal! += p.price! * row.requestedQty; } else result.totalMissing++;
      }
      return result;
    },
    async add_to_cart(id, quantity, confirmed, ctx) { record("add_to_cart", id, quantity, confirmed, ctx); return mutate(ctx.expectedLines, ctx); },
    async add_many_to_cart(items, ctx) { record("add_many_to_cart", items, ctx); return mutate(items, ctx); },
    async get_cart_action_status(id, ctx) { record("get_cart_action_status", id, ctx); const result = actions.get(`${ctx.sessionId}:${id}`); return result ? { status: "succeeded", result } : { status: "not_applied" }; },
    async recordFeedback(id, rating, ctx) { record("recordFeedback", id, rating, ctx); },
  };
  return { tools, products, stocks, calls, actions };
}
