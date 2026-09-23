import type { BackendTools } from "./contracts.ts";
import type { DataQualityWarning, Freshness, Product, SearchResult, SpecificationResult } from "../../shared/types.ts";
import { knownNumber, safeUrl } from "./reasoning.ts";
import { validateRows } from "./files.ts";

type JsonRecord = Record<string, unknown>;
export interface EktExportPage { page: number; per_page: number; count: number; items: JsonRecord[] }
export interface EktSnapshot {
  version: 1;
  sourceFile: string;
  importedAt: string;
  pages: EktExportPage[];
  details: JsonRecord[];
}
function record(value: unknown): value is JsonRecord { return !!value && typeof value === "object" && !Array.isArray(value); }
function string(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function positiveId(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
function rawProduct(value: unknown): asserts value is JsonRecord {
  if (!record(value) || !positiveId(value.id) || !string(value.name) || (value.price !== null && !knownNumber(value.price))) throw new Error("Invalid EKT product");
}

/** Extract JSON objects only. Surrounding prose is never evaluated or treated as instructions. */
export function parseEktExport(text: string, sourceFile: string, importedAt: string): EktSnapshot {
  if (text.length > 20 * 1024 * 1024 || !Number.isFinite(Date.parse(importedAt))) throw new Error("Invalid export input");
  const objects: unknown[] = [];
  let depth = 0, start = -1, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (depth === 0) { if (char === "{") { start = i; depth = 1; quoted = false; escaped = false; } continue; }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) objects.push(JSON.parse(text.slice(start, i + 1)));
  }
  if (depth !== 0) throw new Error("Truncated JSON export");
  const pages: EktExportPage[] = [], details: JsonRecord[] = [];
  for (const object of objects) {
    if (!record(object)) throw new Error("Invalid EKT object");
    if (Array.isArray(object.items)) {
      if (!positiveId(object.page) || !positiveId(object.per_page) || !Number.isSafeInteger(object.count) || object.count !== object.items.length || object.items.length > object.per_page) throw new Error("Invalid EKT page");
      object.items.forEach(rawProduct);
      if (pages.some(p => p.page === object.page)) throw new Error("Duplicate page");
      pages.push(object as unknown as EktExportPage);
    } else {
      rawProduct(object);
      if (details.some(p => p.id === object.id)) throw new Error("Duplicate detail");
      details.push(object);
    }
  }
  if (!pages.length) throw new Error("No catalog pages found");
  return { version: 1, sourceFile: sourceFile.split(/[\\/]/).pop() || "catalog.txt", importedAt, pages: pages.sort((a, b) => a.page - b.page), details };
}

function currentValue(value: string | null): string | null {
  return value?.match(/(?:^|[^\p{L}\d.])(\d+(?:[.,]\d+)?\s*[aа])(?![\p{L}\d])/iu)?.[1] ?? null;
}
function currentConflict(raw: JsonRecord, properties: JsonRecord): DataQualityWarning[] {
  const sources: Record<string, string> = {};
  for (const [key, value] of Object.entries({ name: string(raw.name), description: string(raw.description), properties: string(properties.NOMINALNYY_TOK) })) {
    const current = currentValue(value);
    if (current) sources[key] = current;
  }
  const values = Object.values(sources).map(value => Number(value.replace(/[^\d.,]/g, "").replace(",", ".")));
  return new Set(values).size > 1 ? [{ field: "nominal_current", message: [...new Set(Object.values(sources))].join(" ≠ "), sources }] : [];
}
export function normalizeSnapshotProduct(raw: JsonRecord, metadata: Freshness): Product {
  rawProduct(raw);
  const properties = record(raw.properties) ? structuredClone(raw.properties) : {};
  const stores = Array.isArray(raw.stores) ? raw.stores.map(value => {
    if (!record(value) || !positiveId(value.id) || !string(value.name) || (value.quantity !== null && !knownNumber(value.quantity))) throw new Error("Invalid EKT store");
    return { id: value.id, name: value.name as string, quantity: value.quantity as number | null };
  }) : [];
  return {
    id: raw.id as number, name: raw.name as string, article: string(raw.article),
    supplierArticle: string(properties.ARTIKULPOSTAVSHCHIKA),
    description: string(raw.description), price: knownNumber(raw.price) ? raw.price : null,
    quantity: knownNumber(raw.quantity) ? raw.quantity : null,
    image: safeUrl(string(raw.image)), productUrl: safeUrl(string(raw.url)),
    brand: string(properties.TORGOVAYA_MARKA), category: string(properties.OBYEM),
    properties, stores, certificates: [], dataQualityWarnings: currentConflict(raw, properties), ...metadata,
  };
}
function searchable(value: string): string {
  return value.normalize("NFKC").toLowerCase()
    .replace(/(\d)\s*([акв])(?=[^\p{L}]|$)/gu, (_match, n: string, unit: string) => n + ({ а: "a", к: "k", в: "v" }[unit] ?? unit))
    .replace(/[^\p{L}\d_.-]+/gu, " ").replace(/\s+/g, " ").trim();
}
function exactKeys(p: Product): string[] {
  const firstNameToken = p.name.split(/\s+/)[0];
  return [String(p.id), p.article, p.supplierArticle, string(p.properties?.CML2_BAR_CODE), p.name,
    firstNameToken && /\d/.test(firstNameToken) ? firstNameToken : null].filter((v): v is string => !!v).map(searchable);
}

/** Read-only integration adapter for supplied API exports. No network, no synthetic products. */
export function createSnapshotBackend(snapshot: EktSnapshot): {
  tools: BackendTools;
  products: Product[];
  feedback: { sessionId: string; messageId: string; rating: "up" | "down" }[];
} {
  if (snapshot.version !== 1 || !snapshot.pages.length) throw new Error("Unsupported snapshot");
  const metadata: Freshness = { source: "file", sourceName: snapshot.sourceFile, importedAt: snapshot.importedAt };
  const raw = new Map<number, JsonRecord>();
  for (const page of snapshot.pages) for (const item of page.items) {
    rawProduct(item);
    if (raw.has(item.id as number)) throw new Error("Duplicate catalog product");
    raw.set(item.id as number, item);
  }
  for (const detail of snapshot.details) {
    rawProduct(detail);
    if (!raw.has(detail.id as number)) throw new Error("Detail has no matching list item");
    raw.set(detail.id as number, { ...raw.get(detail.id as number), ...detail });
  }
  const products = [...raw.values()].map(p => normalizeSnapshotProduct(p, metadata));
  const byId = new Map(products.map(p => [p.id, p]));
  const feedback: { sessionId: string; messageId: string; rating: "up" | "down" }[] = [];
  function product(id: number): Product { const p = byId.get(id); if (!p) throw new Error("Unknown snapshot product"); return p; }
  function search(query: string): SearchResult {
    const key = searchable(query), exact = products.filter(p => exactKeys(p).includes(key));
    const tokens = key.split(" ").filter(Boolean);
    const items = exact.length ? exact : tokens.length ? products.filter(p => {
      const haystack = searchable(`${p.name} ${p.article ?? ""} ${p.supplierArticle ?? ""} ${p.brand ?? ""} ${p.properties?.CML2_BAR_CODE ?? ""}`);
      return tokens.every(token => haystack.includes(token));
    }) : [];
    return structuredClone({ items, ...(exact.length === 1 ? { exactMatchId: exact[0]!.id } : {}), ...metadata });
  }
  const tools: BackendTools = {
    async search_products(query) { return search(query); },
    async get_product_detail(id) { return structuredClone(product(id)); },
    async get_availability(id) {
      const p = product(id), total = p.quantity ?? null;
      return structuredClone({ total, available: total === null ? null : total > 0, stores: p.stores ?? [], ...metadata });
    },
    // List-only products have neither verified technical detail nor stock. Never invent candidates.
    async get_analog_candidates(id) { product(id); return []; },
    async get_purchase_terms() { return { approved: false, ...metadata }; },
    async matchSpecification(input) {
      const rows = validateRows(input).map(row => {
        const result = search(row.query);
        const matched = result.exactMatchId ? result.items.find(p => p.id === result.exactMatchId)! : null;
        return { inputQuery: row.query, requestedQty: row.requestedQty, matchedProduct: matched,
          status: matched ? "found" as const : "not_found" as const, analog: null,
          availableQty: matched?.quantity ?? null, unitPrice: matched?.price ?? null,
          lineTotal: matched?.price != null ? Math.round(matched.price * row.requestedQty * 100) / 100 : null };
      });
      const found = rows.filter(r => r.status === "found");
      const result: SpecificationResult = { rows, totalFound: found.length, totalMissing: rows.length - found.length,
        grandTotal: found.some(r => r.lineTotal === null) ? null : Math.round(found.reduce((sum, r) => sum + r.lineTotal!, 0) * 100) / 100, ...metadata };
      return result;
    },
    async add_to_cart() { return { success: false }; },
    async add_many_to_cart() { return { success: false }; },
    async get_cart_action_status() { return { status: "not_applied" }; },
    async recordFeedback(messageId, rating, ctx) {
      feedback.push({ sessionId: ctx.sessionId, messageId, rating });
      if (feedback.length > 1000) feedback.shift();
    },
  };
  return { tools, products: structuredClone(products), feedback };
}
