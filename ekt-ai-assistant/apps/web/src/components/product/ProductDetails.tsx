import type { Product } from "@contract";
import type { Language } from "@/types/ui";
import { propertyText, safeUrl, tr } from "@/lib/format";
import { StockList } from "./StockList";
import { CertificateList } from "./CertificateList";
export function ProductDetails({
  product,
  lang,
}: {
  product: Product;
  lang: Language;
}) {
  return (
    <details className="product-details">
      <summary>{tr(lang, "Толық ақпарат", "Подробная информация")}</summary>
      <div className="details-body">
        {product.description && <p>{product.description}</p>}
        {product.supplierArticle && (
          <p>
            {tr(lang, "Жеткізуші артикулы", "Артикул поставщика")}:{" "}
            {product.supplierArticle}
          </p>
        )}
        {!!Object.keys(product.properties ?? {}).length && (
          <dl>
            {Object.entries(product.properties ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{propertyText(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <StockList
          stores={product.stores}
          quantity={product.quantity}
          lang={lang}
        />
        <CertificateList certificates={product.certificates} lang={lang} />
        {safeUrl(product.productUrl) && (
          <a
            className="text-button"
            href={safeUrl(product.productUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr(lang, "Тауар бетіне өту ↗", "Перейти к товару ↗")}
          </a>
        )}
      </div>
    </details>
  );
}
