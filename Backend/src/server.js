import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Catalog } from './catalog.js';
import { EktClient } from './client.js';

export async function loadSample() {
  const records = [];
  for (const filename of ['page-1.json', 'page-2.json', 'detail-515291.json']) {
    const file = new URL(`../data/${filename}`, import.meta.url);
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const fetchedAt = (await stat(file)).mtime.toISOString();
    for (const item of raw.items ?? [raw]) {
      const index = records.findIndex(record => record.raw.id === item.id);
      const record = { raw: item, fetchedAt, source: 'cache' };
      if (index >= 0) records[index] = record; else records.push(record);
    }
  }
  return new Catalog(records);
}
function envelope(data, products, mode) {
  return { ...data, fetchedAt: products.length ? products.map(p => p.fetchedAt).sort()[0] : null,
    source: products.length && products.every(p => p.source === 'ekt_api') ? 'ekt_api' : 'cache', mode };
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createServer(catalog, mode = 'sample') {
  return http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/products') {
        const items = catalog.searchProducts(url.searchParams.get('q') ?? '');
        return send(200, envelope({ items }, items.length ? items.map(i => i.product) : catalog.products, mode));
      }
      const detail = url.pathname.match(/^\/api\/products\/(\d+)(\/analogs)?$/);
      if (req.method === 'GET' && detail) {
        const product = await catalog.getProduct(Number(detail[1]));
        if (!product) return send(404, { error: 'Product not found' });
        const items = detail[2] ? catalog.findAnalogs(product) : null;
        return send(200, envelope(items ? { items } : { product }, [product, ...(items ?? []).map(i => i.product)], mode));
      }
      if (req.method === 'POST' && url.pathname === '/api/specifications/match') {
        let body;
        try { body = await readBody(req); } catch { return send(400, { error: 'Invalid JSON or body exceeds 128 KiB' }); }
        let result;
        try { result = await catalog.matchSpecification(body.rows); }
        catch (error) {
          if (error.message.startsWith('Expected') || error.message.startsWith('Line total')) return send(400, { error: error.message });
          throw error;
        }
        return send(200, envelope(result, result.rows.flatMap(r => [r.matchedProduct, r.analog].filter(Boolean)).concat(catalog.products), mode));
      }
      return send(404, { error: 'Route not found' });
    } catch { send(502, { error: 'Catalog source unavailable or invalid' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env.EKT_MODE ?? 'sample';
  if (!['sample', 'live'].includes(mode)) throw new Error('EKT_MODE must be sample or live');
  const client = mode === 'live' ? new EktClient({ baseUrl: process.env.EKT_API_BASE_URL, login: process.env.EKT_API_LOGIN, password: process.env.EKT_API_PASSWORD }) : null;
  const catalog = client ? new Catalog(await client.catalog(), { client }) : await loadSample();
  const port = Number(process.env.PORT ?? 8001);
  createServer(catalog, mode).listen(port, '127.0.0.1', () => console.log(`EKT backend: http://127.0.0.1:${port} (${mode})`));
}
