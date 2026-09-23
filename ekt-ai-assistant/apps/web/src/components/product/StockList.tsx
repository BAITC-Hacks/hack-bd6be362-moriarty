"use client";
import { useState } from "react";
import type { StoreStock } from "@contract";
import type { Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function StockList({
  stores,
  quantity,
  lang,
}: {
  stores?: StoreStock[];
  quantity?: number | null;
  lang: Language;
}) {
  const [all, setAll] = useState(false);
  const visible = stores?.filter((s) => all || s.quantity > 0) ?? [];
  return (
    <section className="stock-list">
      <strong>
        {quantity == null
          ? tr(lang, "Қалдық белгісіз", "Остаток неизвестен")
          : `${tr(lang, "Қолда бар", "В наличии")}: ${quantity}`}
      </strong>
      {visible.map((store, i) => (
        <div className="stock-row" key={`${store.id}-${i}`}>
          <span>{store.name}</span>
          <span>
            {store.quantity} {tr(lang, "дана", "шт.")}
          </span>
        </div>
      ))}
      {!!stores?.some((s) => s.quantity <= 0) && (
        <button className="text-button" onClick={() => setAll(!all)}>
          {all
            ? tr(lang, "Тек қолда бар қоймалар", "Только склады с наличием")
            : tr(lang, "Барлық қойманы көрсету", "Показать все склады")}
        </button>
      )}
    </section>
  );
}
