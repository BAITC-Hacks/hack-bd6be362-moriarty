import type { Language, PendingConfirmation, SpecEstimate } from "@/types/ui";
import { money, tr } from "@/lib/format";
export function SpecEstimateView({
  estimate,
  lang,
  bulkEnabled,
  disabled,
  onConfirm,
}: {
  estimate: SpecEstimate;
  lang: Language;
  bulkEnabled: boolean;
  disabled?: boolean;
  onConfirm: (value: PendingConfirmation) => void;
}) {
  const items = estimate.rows
    .filter((row) => row.status === "found" && row.product)
    .map((row) => ({
      productId: row.product!.id,
      name: row.product!.name,
      quantity: row.quantity,
      price: row.unitPrice ?? null,
    }));
  const missing = estimate.rows.some(
    (row) => row.unitPrice == null || row.subtotal == null,
  );
  return (
    <section className="estimate-view">
      <h3>{tr(lang, "Спецификация есебі", "Расчёт спецификации")}</h3>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr(lang, "Спецификация кестесі", "Таблица спецификации")}
      >
        <table>
          <thead>
            <tr>
              {[
                tr(lang, "Сұраныс", "Запрос"),
                tr(lang, "Тапқан тауар", "Товар"),
                tr(lang, "Күй", "Статус"),
                tr(lang, "Бағасы", "Цена"),
                tr(lang, "Саны", "Кол-во"),
                tr(lang, "Сомасы", "Сумма"),
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estimate.rows.map((row, i) => (
              <tr key={i}>
                <td>{row.requestText}</td>
                <td>{row.product?.name ?? "—"}</td>
                <td>
                  <span className={`status ${row.status}`}>
                    {row.status === "found"
                      ? tr(lang, "✓ Табылды", "✓ Найдено")
                      : row.status === "analog"
                        ? tr(lang, "~ Аналог", "~ Аналог")
                        : tr(lang, "✗ Табылмады", "✗ Не найдено")}
                  </span>
                </td>
                <td>
                  {row.unitPrice == null
                    ? tr(lang, "Баға жоқ", "Нет цены")
                    : money(row.unitPrice)}
                </td>
                <td>{row.quantity}</td>
                <td>{money(row.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="estimate-total">
        <span>{tr(lang, "Жалпы сома", "Общая сумма")}</span>
        <strong>{money(estimate.total)}</strong>
      </div>
      {missing && (
        <p className="muted">
          {tr(
            lang,
            "Кейбір бағалар жоқ. Көрсетілген сома толық болмауы мүмкін.",
            "Часть цен отсутствует. Указанная сумма может быть неполной.",
          )}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={!bulkEnabled || disabled || !items.length}
        onClick={() => onConfirm({ items, bulk: true })}
      >
        {tr(
          lang,
          "Барлық табылған тауарды корзинаға қосу",
          "Добавить все найденные товары в корзину",
        )}
      </button>
      {!bulkEnabled && (
        <p className="muted">
          {tr(
            lang,
            "Бұл әрекет backend жағында әлі қолжетімсіз.",
            "Это действие пока недоступно на backend.",
          )}
        </p>
      )}
      <p className="muted">
        {tr(
          lang,
          "Аналогтар бөлек расталуы керек.",
          "Аналоги требуют отдельного подтверждения.",
        )}
      </p>
    </section>
  );
}
