import type { Language } from "../../shared/types.ts";
import type { IntentPlan } from "./contracts.ts";

export function normalized(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().trim().replace(/[,.!?:;]+/g, " ").replace(/\s+/g, " ").trim();
}
const confirmations = new Set([
  "иә", "ия", "иә қос", "ия қос", "корзинаға қос", "себетке қос", "иә корзинаға сал",
  "растаймын", "қосыңыз", "да", "да добавь", "добавить в корзину", "подтверждаю", "да положи в корзину",
]);
const cancellations = new Set(["жоқ", "бас тарту", "қоспа", "нет", "отмена", "отменить", "не добавляй"]);
export function parseConfirmation(text: string): "confirm" | "cancel" | null {
  if (/[?？]/.test(text)) return null;
  const value = normalized(text);
  return confirmations.has(value) ? "confirm" : cancellations.has(value) ? "cancel" : null;
}
export function detectLanguage(text: string, previous: Language): Language {
  if (/[әғқңөұүһі]/i.test(text) || /(?:^|\s)(дана|керек|бар ма)(?:\s|$|[,.!?])/i.test(text)) return "kk";
  if (/(сколько|добав|нуж|цен|налич|сравни|достав|оплат|сертификат|покажи|подтверждаю|корзину|штук|возьму|^да(?:\s|$|[,.!?])|^нет(?:\s|$|[,.!?]))/i.test(text)) return "ru";
  return previous;
}
export function requestedQuantity(text: string): number | undefined {
  const numeric = text.match(/(?:^|\s)(-?\d+(?:[.,]\d+)?)\s*(?:дана|данасын|данасынaн|штук[аи]?|шт\.?)(?=\s|$|[,.!?])/i)
    ?? text.match(/(?:мне нужно|нужно|возьму|маған)\s+(-?\d+(?:[.,]\d+)?)(?=\s|$)/i);
  if (numeric) return Number(numeric[1]!.replace(",", "."));
  if (/возьму два|екі дана/i.test(text)) return 2;
  return undefined;
}
export function localIntent(text: string): IntentPlan {
  const q = normalized(text);
  const quantity = requestedQuantity(text);
  const store = /алматы|алмата/i.test(q) ? "Алматы" : /астана|нур[ -]султан|нұр[ -]сұлтан/i.test(q) ? "Астана" : undefined;
  if (/төлем|жеткізу|партия|оплат|достав|условия|минималь/i.test(q)) return { intent: "PURCHASE_TERMS" };
  if (/салыстыр|сравни/i.test(q)) return { intent: "PRODUCT_COMPARE" };
  if (/аналог|балама|жоқ болса|нет в наличии|замен/i.test(q)) return { intent: "ANALOG_SEARCH" };
  if (quantity !== undefined || /корзин|себет|хочу купить|сатып ал|возьму/i.test(q)) return { intent: "ADD_TO_CART_REQUEST", quantity };
  if (store) return { intent: "STORE_STOCK_CHECK", store };
  if (/баға|бағасы|цен|сколько стоит|қанша тұрады/i.test(q)) return { intent: "PRICE_CHECK" };
  if (/қалдық|қалды|налич|склад|қойма|бар ма/i.test(q)) return { intent: "STOCK_CHECK" };
  if (/сипаттама|характерист|сертификат|толық|подробн|ақпарат/i.test(q)) return { intent: "PRODUCT_INFO" };
  if (!q || /^(сәлем|салем|привет|здравствуйте|рахмет|спасибо)$/.test(q)) return { intent: "UNKNOWN" };
  return { intent: "PRODUCT_SEARCH", query: text };
}

/** Remove conversational filler only; preserve articles and technical values. */
export function productQuery(text: string): string {
  return text.replace(/(?:^|\s)-?\d+(?:[.,]\d+)?\s*(?:дана\S*|штук[аи]?|шт\.?)(?=\s|$|[,.!?])/gi, " ")
    .replace(/ма[ғг]ан|мне|нужно|керек|возьму|хочу купить|бар ма|бағасы|қанша|қалды|сколько стоит|цена|наличие|сипаттамасы|характеристики|сертификат|корзинаға|себетке|добавь|добавить|в корзину|қосыңыз|қос|осы тауар|этот товар|бастапқысын\S*|первоначальн\S*|алматыда|астанада|покажи|пожалуйста|баға|ақпарат|подробности/gi, " ")
    .replace(/[?!,]/g, " ").replace(/\s+/g, " ").trim();
}
