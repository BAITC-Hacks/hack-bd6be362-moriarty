import type { Language } from "@/types/ui";
export const tr = (lang: Language, kk: string, ru: string) =>
  lang === "kk" ? kk : ru;
export const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("ru-KZ", {
        style: "currency",
        currency: "KZT",
        maximumFractionDigits: 2,
      }).format(value);
export function safeUrl(value?: string | null): string | undefined {
  if (!value || value.trim() !== value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function propertyText(value: unknown): string {
  if (value == null) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
