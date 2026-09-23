import type { AnalogExplanation, DataQualityWarning, Freshness, Language, Product } from "../../shared/types.ts";

export function say(language: Language, kk: string, ru: string): string { return language === "kk" ? kk : ru; }
export function money(value: number, language: Language): string { return `${value.toLocaleString(language === "kk" ? "kk-KZ" : "ru-RU", { maximumFractionDigits: 2 })} ₸`; }
export function knownNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
export function validQuantity(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 1000000; }
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function freshText(meta: Freshness, language: Language, now: number, thresholdMs: number): string {
  if (meta.source === "file") return say(language,
    `Дерек көзі: ${meta.sourceName ?? "файл"} файлындағы көшірме. API жаңартылған уақыты берілмеген; ағымдағы баға мен қалдық тексерілмеген.`,
    `Источник: копия из файла ${meta.sourceName ?? "каталога"}. Время обновления API не указано; текущие цена и остаток не проверены.`);
  const timestamp = meta.fetchedAt ? Date.parse(meta.fetchedAt) : NaN;
  if (!Number.isFinite(timestamp) || !meta.source) return "";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  const source = meta.source === "ekt_api" ? "EKT API" : say(language, "кэш", "кэш");
  let result = say(language, `Дерек көзі: ${source}, ${minutes} минут бұрын жаңартылды.`, `Источник: ${source}, обновлено ${minutes} мин. назад.`);
  if (meta.source === "cache" && now - timestamp > thresholdMs) result += say(language, " Бұл дерек сәл ескіруі мүмкін, қайта тексеруді ұсынамын.", " Данные могут быть устаревшими, рекомендую обновить.");
  return result;
}
export function warningText(warnings: DataQualityWarning[], language: Language): string {
  if (!warnings.length) return "";
  return say(language, "Каталог деректерінде сәйкессіздік бар:\n", "В данных каталога есть расхождения:\n") + warnings.map(w => {
    const sources = Object.entries(w.sources ?? w.values ?? {}).map(([key, value]) => `${key}: ${value}`).join("; ");
    return `${w.field}: ${w.message}${sources ? ` (${sources})` : ""}`;
  }).join("\n");
}
const propertyLabels: Record<string, [string, string]> = {
  OBYEM: ["Тауар түрі", "Тип товара"],
  KOLICHESTVO_POLYUSOV: ["Полюстер", "Полюса"],
  NOMINALNYY_TOK: ["Номиналды ток (техникалық өріс)", "Номинальный ток (поле характеристик)"],
  NOMINALNOE_NAPRYAZHENIE: ["Номиналды кернеу", "Номинальное напряжение"],
  NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST: ["Ажырату қабілеті", "Отключающая способность"],
  TIP_USTANOVKI: ["Орнату түрі", "Тип установки"],
  CML2_BAR_CODE: ["Штрихкод", "Штрихкод"],
};
export function productText(product: Product, language: Language, details = false): string {
  const out = [product.name];
  if (product.article) out.push(say(language, `Артикул: ${product.article}`, `Артикул: ${product.article}`));
  if (product.supplierArticle) out.push(say(language, `Жеткізуші артикулы: ${product.supplierArticle}`, `Артикул поставщика: ${product.supplierArticle}`));
  out.push(knownNumber(product.price) ? say(language, `Бағасы: ${money(product.price, language)}`, `Цена: ${money(product.price, language)}`) : say(language, "Баға белгісіз.", "Цена неизвестна."));
  if (details) {
    if (product.description) out.push(product.description);
    if (product.brand) out.push(say(language, `Бренд: ${product.brand}`, `Бренд: ${product.brand}`));
    for (const [key, value] of Object.entries(product.properties ?? {})) {
      const label = propertyLabels[key];
      // EKT internal merchandising/import fields stay in structured data, not customer chat.
      if (product.properties?.CML2_ARTICLE !== undefined && !label) continue;
      if (["string", "number", "boolean"].includes(typeof value)) out.push(`${label ? say(language, label[0], label[1]) : key}: ${String(value)}`);
    }
    const certs = (product.certificates ?? []).filter(c => safeUrl(c.url));
    out.push(certs.length ? certs.map(c => `${c.name}: ${safeUrl(c.url)}`).join("\n") : say(language, "Берілген деректерде сертификат табылмады.", "В предоставленных данных сертификат не найден."));
    if (safeUrl(product.productUrl)) out.push(safeUrl(product.productUrl)!);
  }
  const warning = warningText(product.dataQualityWarnings ?? [], language);
  if (warning) out.push(warning);
  return out.join("\n");
}

const fields = [
  { key: "category", kk: "Санат", ru: "Категория", aliases: ["category", "type"] },
  { key: "voltage", kk: "Кернеу", ru: "Напряжение", aliases: ["voltage", "rated_voltage", "NAPRYAZHENIE", "NOMINALNOE_NAPRYAZHENIE"] },
  { key: "nominal_current", kk: "Номиналды ток", ru: "Номинальный ток", aliases: ["nominal_current", "current", "NOMINALNYY_TOK"] },
  { key: "poles", kk: "Полюстер", ru: "Полюса", aliases: ["poles", "pole_count", "KOLICHESTVO_POLYUSOV"] },
  { key: "breaking_capacity", kk: "Ажырату қабілеті", ru: "Отключающая способность", aliases: ["breaking_capacity", "breakingCapacity", "OTKLYUCHAYUSHCHAYA_SPOSOBNOST", "NOMINALNAYA_OTKLYUCHAYUSHCHAYA_SPOSOBNOST"] },
] as const;
function fieldValue(product: Product, aliases: readonly string[]): string | null {
  const data = { ...product.properties, category: product.category ?? product.properties?.category };
  for (const alias of aliases) {
    const entry = Object.entries(data).find(([key]) => key.toLowerCase() === alias.toLowerCase());
    const value = entry?.[1];
    if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) return String(value);
  }
  return null;
}
function comparable(value: string): string { return value.toLowerCase().replace(/\s+/g, "").replace(/а/g, "a").replace(/в/g, "v").replace(/к/g, "k"); }
export function explainAnalog(original: Product | null, candidate: Product, language: Language): AnalogExplanation {
  const matches: string[] = [], differences: string[] = [], unknown: string[] = [];
  const conflicts = [...(original?.dataQualityWarnings ?? []), ...(candidate.dataQualityWarnings ?? [])];
  if (!original) unknown.push(say(language, "Бастапқы тауар анықталмаған; техникалық сәйкестікті растау мүмкін емес.", "Исходный товар не определён; техническое соответствие не подтверждено."));
  else {
    if (original.brand && candidate.brand) {
      const label = `Бренд: ${original.brand}`;
      if (comparable(original.brand) === comparable(candidate.brand)) matches.push(label);
      else differences.push(`Бренд: ${original.brand} → ${candidate.brand}`);
    }
    for (const field of fields) {
      const label = language === "kk" ? field.kk : field.ru;
      if (conflicts.some(w => [field.key, ...field.aliases].some(key => key.toLowerCase() === w.field.toLowerCase()))) {
        unknown.push(label + say(language, ": каталогта сәйкессіздік бар", ": расхождение в каталоге"));
        continue;
      }
      const a = fieldValue(original, field.aliases), b = fieldValue(candidate, field.aliases);
      if (!a || !b) unknown.push(label);
      else if (comparable(a) === comparable(b)) matches.push(`${label}: ${a}`);
      else differences.push(`${label}: ${a} → ${b}`);
    }
  }
  if (conflicts.length) unknown.push(warningText(conflicts, language));
  // Different category/current/etc. never silently becomes an exact replacement.
  const exactReplacement = Boolean(original) && !unknown.length && !differences.length;
  const parts = [candidate.name,
    say(language, "Сәйкес: ", "Совпадает: ") + (matches.join("; ") || say(language, "расталмаған", "не подтверждено")),
    say(language, "Айырмашылықтар: ", "Различия: ") + (differences.join("; ") || say(language, "берілген өрістерде анықталмады", "не выявлены в переданных полях")),
  ];
  if (unknown.length) parts.push(say(language, "Тексеру қажет: ", "Требует проверки: ") + unknown.join("; "));
  if (!exactReplacement) parts.push(say(language, "Ықтимал аналог; қолдануға сәйкестігін маманмен тексеріңіз.", "Возможный аналог; применимость требует проверки специалистом."));
  return { product: candidate, matches, differences, unknown, exactReplacement, message: parts.join("\n") };
}
export function compareProducts(products: Product[], language: Language): string {
  return products.map(p => {
    const lines = [productText(p, language)];
    for (const field of fields) lines.push(`${language === "kk" ? field.kk : field.ru}: ${fieldValue(p, field.aliases) ?? say(language, "белгісіз", "неизвестно")}`);
    lines.push(say(language, `Қалдық: ${knownNumber(p.quantity) ? p.quantity : "белгісіз"}`, `Остаток: ${knownNumber(p.quantity) ? p.quantity : "неизвестно"}`));
    return lines.join("\n");
  }).join("\n\n");
}
