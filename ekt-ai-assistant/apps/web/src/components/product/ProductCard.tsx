"use client";
import { useState } from "react";
import { Package, ShoppingBag } from "lucide-react";
import type { Product } from "@contract";
import type { Language, PendingConfirmation } from "@/types/ui";
import { money, propertyText, safeUrl, tr } from "@/lib/format";
import { ProductDetails } from "./ProductDetails";
import { DataWarning } from "./DataWarning";
export type ProductCardProps = {
  product: Product;
  lang: Language;
  disabled?: boolean;
  onConfirm: (value: PendingConfirmation) => void;
};
export function ProductCard({
  product,
  lang,
  disabled,
  onConfirm,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState("1");
  const [imageFailed, setImageFailed] = useState(false);
  const count = Number(quantity);
  const valid = Number.isSafeInteger(count) && count >= 1;
  const image = safeUrl(product.image);
  return (
    <article className="product-card">
      <div className="product-main">
        <div className="product-image">
          {image && !imageFailed ? (
            <img
              src={image}
              alt={product.name}
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <Package
              size={40}
              strokeWidth={1.2}
              aria-label={tr(lang, "Сурет жоқ", "Нет изображения")}
            />
          )}
        </div>
        <div className="product-info">
          {product.brand && <span className="eyebrow">{product.brand}</span>}
          <h3>{product.name}</h3>
          {product.article && (
            <p className="muted">
              {tr(lang, "Артикул", "Артикул")}: {product.article}
            </p>
          )}
          <div className="property-chips">
            {Object.entries(product.properties ?? {})
              .slice(0, 4)
              .map(([key, value]) => (
                <span key={key} title={key}>
                  {propertyText(value)}
                </span>
              ))}
          </div>
        </div>
      </div>
      <div className="product-pricing">
        <strong>
          {product.price == null
            ? tr(lang, "Баға көрсетілмеген", "Цена не указана")
            : money(product.price)}
        </strong>
        <span
          className={
            product.quantity != null && product.quantity > 0
              ? "available"
              : "muted"
          }
        >
          {product.quantity == null
            ? tr(lang, "Қалдық белгісіз", "Остаток неизвестен")
            : `${tr(lang, "Қолда бар", "В наличии")}: ${product.quantity}`}
        </span>
      </div>
      <DataWarning warnings={product.dataQualityWarnings} lang={lang} />
      <ProductDetails product={product} lang={lang} />
      <div className="cart-controls">
        <label className="quantity-control">
          <span>{tr(lang, "Саны", "Кол-во")}</span>
          <input
            aria-label={`${tr(lang, "Саны", "Количество")}: ${product.name}`}
            inputMode="numeric"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <button
          className="button primary"
          disabled={disabled || !valid}
          onClick={() =>
            onConfirm({
              items: [
                {
                  productId: product.id,
                  name: product.name,
                  quantity: count,
                  price: product.price,
                },
              ],
            })
          }
        >
          <ShoppingBag size={16} />
          {tr(lang, "Корзинаға қосу", "В корзину")}
        </button>
      </div>
      {!valid && (
        <p className="field-error">
          {tr(
            lang,
            "Кемінде 1 бүтін сан енгізіңіз.",
            "Введите целое число не меньше 1.",
          )}
        </p>
      )}
    </article>
  );
}
