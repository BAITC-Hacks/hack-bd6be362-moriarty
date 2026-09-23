import type { Product } from "@contract";
import type { Language } from "@/types/ui";
import { money, propertyText, tr } from "@/lib/format";
import { DataWarning } from "@/components/product/DataWarning";
export function ProductCompareView({
  products,
  lang,
}: {
  products: Product[];
  lang: Language;
}) {
  const keys = [
    ...new Set(products.flatMap((p) => Object.keys(p.properties ?? {}))),
  ];
  const rows = [
    {
      name: tr(lang, "Бренд", "Бренд"),
      values: products.map((p) => p.brand ?? "—"),
    },
    ...keys.map((key) => ({
      name: key,
      values: products.map((p) => propertyText(p.properties?.[key])),
    })),
    {
      name: tr(lang, "Бағасы", "Цена"),
      values: products.map((p) => money(p.price)),
    },
    {
      name: tr(lang, "Қалдық", "Остаток"),
      values: products.map((p) => String(p.quantity ?? "—")),
    },
  ];
  return (
    <section>
      {products.map((p, i) =>
        p.dataQualityWarnings?.length ? (
          <div key={i}>
            <strong>{p.name}</strong>
            <DataWarning warnings={p.dataQualityWarnings} lang={lang} />
          </div>
        ) : null,
      )}
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr(lang, "Тауарларды салыстыру", "Сравнение товаров")}
      >
        <table>
          <caption>
            {tr(lang, "Тауарларды салыстыру", "Сравнение товаров")}
          </caption>
          <thead>
            <tr>
              <th>{tr(lang, "Параметр", "Параметр")}</th>
              {products.map((p, i) => (
                <th key={i}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th>{row.name}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
