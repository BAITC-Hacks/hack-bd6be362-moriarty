import { key, normalizeProduct } from './normalize.js';

function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}
const identifiers = p => [p.article, p.supplierArticle, String(p.id)].map(key).filter(Boolean);
export class Catalog {
  constructor(records, { client = null } = {}) {
    this.products = records.map(({ raw, ...meta }) => normalizeProduct(raw, meta));
    this.client = client;
  }
  searchProducts(query) {
    const q = key(query);
    if (!q || q.length > 200) return [];
    const exact = this.products.filter(p => identifiers(p).includes(q) || key(p.name) === q);
    if (exact.length) return exact.map(product => ({ product, matchType: 'exact' }));
    const substring = this.products.filter(p => [p.name, ...identifiers(p)].some(value => key(value).includes(q)));
    if (substring.length) return substring.map(product => ({ product, matchType: 'substring' }));
    if (q.length < 4) return [];
    return this.products.map(product => ({ product, distance: Math.min(...[...identifiers(product), key(product.name), ...key(product.name).split(/\s+/)].map(v => distance(q, v))) }))
      .filter(item => item.distance <= (q.length >= 8 ? 2 : 1))
      .sort((a, b) => a.distance - b.distance || a.product.id - b.product.id)
      .map(({ product }) => ({ product, matchType: 'fuzzy' }));
  }
  async getProduct(id) {
    if (this.client) {
      const { data, ...meta } = await this.client.getProduct(id);
      const product = normalizeProduct(data, meta);
      if (product.id !== id) throw new Error('EKT returned a different product');
      const index = this.products.findIndex(p => p.id === id);
      if (index < 0) this.products.push(product); else this.products[index] = product;
      return product;
    }
    return this.products.find(p => p.id === id) ?? null;
  }
  findAnalogs(product) {
    const fields = ['poles', 'current', 'voltage', 'breakingCapacity'];
    if (!product.category || product.warnings.length || fields.some(f => !product.specifications[f])) return [];
    return this.products.filter(p => p.id !== product.id && p.quantity > 0 && !p.warnings.length && key(p.category) === key(product.category) && fields.every(f => key(p.specifications[f]) === key(product.specifications[f])))
      .map(p => ({ product: p, reason: 'Same catalog category, poles, current, voltage and breaking capacity; engineering verification required.' }));
  }
  async matchSpecification(rows) {
    if (!Array.isArray(rows) || rows.length > 200 || rows.some(r => !r || typeof r.query !== 'string' || !r.query.trim() || r.query.length > 200 || !Number.isFinite(r.requestedQty) || r.requestedQty <= 0)) throw new Error('Expected up to 200 rows with query and positive requestedQty');
    const results = [];
    for (const row of rows) {
      let candidates = this.searchProducts(row.query);
      // List responses omit supplierArticle. Resolve a unique substring candidate
      // against the detail endpoint before deciding whether it is an exact match.
      if (this.client && candidates.length === 1 && candidates[0].matchType === 'substring') {
        await this.getProduct(candidates[0].product.id);
        candidates = this.searchProducts(row.query);
      }
      // Only a unique exact identifier/name is a confirmed match. Search suggestions are not confirmations.
      const match = candidates.length === 1 && candidates[0].matchType === 'exact' ? await this.getProduct(candidates[0].product.id) : null;
      let analog = null;
      if (!match) {
        // An ambiguous set may offer an alternative only when all candidates have the same verified specifications.
        const reference = candidates[0]?.product;
        if (reference && candidates.every(c => c.matchType !== 'fuzzy' && JSON.stringify(c.product.specifications) === JSON.stringify(reference.specifications))) analog = this.findAnalogs(reference)[0]?.product ?? null;
      }
      const lineTotal = match?.price != null ? Math.round(match.price * row.requestedQty * 100) / 100 : null;
      if (lineTotal !== null && !Number.isFinite(lineTotal)) throw new Error('Line total exceeds supported range');
      results.push({ inputQuery: row.query, matchedProduct: match, status: match ? 'found' : analog ? 'analog_suggested' : 'not_found', analog, requestedQty: row.requestedQty, availableQty: match?.quantity ?? null, unitPrice: match?.price ?? null, lineTotal });
    }
    const grandTotal = Math.round(results.reduce((sum, r) => sum + (r.lineTotal ?? 0), 0) * 100) / 100;
    if (!Number.isFinite(grandTotal)) throw new Error('Line total exceeds supported range');
    return { rows: results, totalFound: results.filter(r => r.status === 'found').length, totalMissing: results.filter(r => r.status !== 'found').length, grandTotal };
  }
}
