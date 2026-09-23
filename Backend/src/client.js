export class EktClient {
  constructor({ baseUrl = 'https://ekt.kz/api/', login, password, ttlMs = 60000, fetchImpl = fetch, now = () => Date.now() } = {}) {
    this.baseUrl = new URL(baseUrl);
    if (this.baseUrl.protocol !== 'https:' || this.baseUrl.username || this.baseUrl.password) throw new Error('EKT requires HTTPS without URL credentials');
    if (!login || !password) throw new Error('Set EKT_API_LOGIN and EKT_API_PASSWORD');
    this.auth = `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
    this.ttlMs = ttlMs; this.fetch = fetchImpl; this.now = now; this.cache = new Map();
  }
  async request(path) {
    const cached = this.cache.get(path);
    if (cached && this.now() - Date.parse(cached.fetchedAt) < this.ttlMs) return structuredClone({ ...cached, source: 'cache' });
    let response;
    try {
      response = await this.fetch(new URL(path, this.baseUrl), {
        headers: { Authorization: this.auth, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000), redirect: 'error',
      });
    } catch { throw new Error('EKT connection failed'); }
    if (!response.ok) throw new Error(`EKT HTTP ${response.status}`);
    const result = { data: await response.json(), fetchedAt: new Date(this.now()).toISOString(), source: 'ekt_api' };
    this.cache.set(path, structuredClone(result));
    return result;
  }
  async listProducts(page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid page');
    const result = await this.request(`products?page=${page}`);
    if (!Array.isArray(result.data?.items)) throw new Error('Invalid EKT list schema');
    return result;
  }
  async getProduct(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid product id');
    return this.request(`products/detail?id=${id}`);
  }
  async catalog(maxPages = 1000) {
    const records = [], seen = new Set();
    for (let page = 1; page <= maxPages; page++) {
      const result = await this.listProducts(page);
      if (!result.data.items.length) return records;
      let added = 0;
      for (const raw of result.data.items) {
        if (!seen.has(raw.id)) { seen.add(raw.id); records.push({ raw, fetchedAt: result.fetchedAt, source: result.source }); added++; }
      }
      if (!added) throw new Error('EKT pagination repeated a page');
    }
    throw new Error('EKT pagination limit reached; catalog is incomplete');
  }
}
