export const text = value => String(value ?? '').replaceAll('\\_', '_').trim();
export const key = value => text(value).toLocaleLowerCase().replace(/\s+/g, ' ');
const number = value => value === null || value === undefined || value === '' ? null :
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
function url(value) {
  const raw = text(value).replace(/^\[[\s\S]*?\]\((https?:\/\/[^\s]+)\)$/, '$1');
  try { const parsed = new URL(raw); return parsed.protocol === 'https:' ? parsed.href : null; }
  catch { return null; }
}

export function normalizeProduct(raw, { fetchedAt, source }) {
  if (!raw || !Number.isSafeInteger(raw.id) || raw.id <= 0 || !text(raw.name)) throw new Error('Invalid EKT product');
  if (!['ekt_api', 'cache'].includes(source) || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('Invalid freshness metadata');
  const properties = Object.fromEntries(Object.entries(raw.properties ?? {}).map(([k, v]) => [text(k), v]));
  const warnings = [];
  const titleCurrent = text(raw.name).match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*[АA](?=\s|$)/i)?.[1];
  const propertyCurrent = text(properties.NOMINALNYY_TOK).match(/\d+(?:[.,]\d+)?/)?.[0];
  if (titleCurrent && propertyCurrent && Number(titleCurrent.replace(',', '.')) !== Number(propertyCurrent.replace(',', '.'))) warnings.push('nominal_current_conflict');
  const stores = (raw.stores ?? []).map(store => ({ id: store.id, name: text(store.name), quantity: number(store.quantity) }));
  const quantity = number(raw.quantity);
  if (quantity !== null && stores.length && stores.every(s => s.quantity !== null) && stores.reduce((sum, s) => sum + s.quantity, 0) !== quantity) warnings.push('stock_total_conflict');
  return {
    id: raw.id, name: text(raw.name), article: text(raw.article),
    supplierArticle: text(properties.ARTIKULPOSTAVSHCHIKA),
    description: text(raw.description), price: number(raw.price), currency: 'KZT',
    quantity, stores, image: url(raw.image), url: url(raw.url),
    brand: text(properties.TORGOVAYA_MARKA), category: text(properties.OBYEM),
    specifications: {
      poles: text(properties.KOLICHESTVO_POLYUSOV) || null,
      current: warnings.includes('nominal_current_conflict') ? null : text(properties.NOMINALNYY_TOK) || null,
      voltage: text(properties.NOMINALNOE_NAPRYAZHENIE) || null,
      breakingCapacity: text(properties.NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST) || null,
    },
    certificateUrl: url(raw.certificate_url), minQuantity: number(properties.KRATNOST_MIN),
    properties, warnings, fetchedAt, source,
  };
}
