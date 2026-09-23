"use client";
import { useEffect, useRef } from "react";
import { ShoppingBag, X } from "lucide-react";
import type { Language, PendingConfirmation } from "@/types/ui";
import { money, tr } from "@/lib/format";
export function ConfirmationModal({
  value,
  lang,
  onCancel,
  onConfirm,
}: {
  value: PendingConfirmation | null;
  lang: Language;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!value) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    cancel.current?.focus();
    const element = dialog.current;
    return () => {
      element?.close();
      previous?.focus();
    };
  }, [value]);
  if (!value) return null;
  const complete = value.items.every((i) => i.price != null);
  const total = complete
    ? value.items.reduce((sum, i) => sum + i.quantity * i.price!, 0)
    : null;
  const valid =
    value.items.length > 0 &&
    value.items.every(
      (i) => Number.isSafeInteger(i.quantity) && i.quantity >= 1,
    );
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      aria-labelledby="confirmation-title"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
    >
      <div className="modal-heading">
        <span className="modal-icon">
          <ShoppingBag size={23} />
        </span>
        <button
          className="icon-button"
          onClick={onCancel}
          aria-label={tr(lang, "Жабу", "Закрыть")}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="confirmation-title">
        {tr(lang, "Корзинаға қосасыз ба?", "Добавить в корзину?")}
      </h2>
      <p className="muted">
        {tr(
          lang,
          "Тауар мен санын тексеріңіз. Қалдықты сервер тексереді.",
          "Проверьте товары и количество. Наличие проверит сервер.",
        )}
      </p>
      <div className="confirmation-items">
        {value.items.map((item, i) => (
          <div className="confirmation-item" key={i}>
            <strong>{item.name}</strong>
            <div>
              <span>
                {tr(lang, "Саны", "Количество")}: {item.quantity}
              </span>
              <span>
                {money(item.price)} × {item.quantity}
              </span>
            </div>
            <b>
              {money(item.price == null ? null : item.price * item.quantity)}
            </b>
          </div>
        ))}
      </div>
      <div className="confirmation-total">
        <span>{tr(lang, "Жалпы", "Итого")}</span>
        <strong>{money(total)}</strong>
      </div>
      {!complete && (
        <p className="notice warning">
          {tr(
            lang,
            "Баға жоқ: толық соманы есептеу мүмкін емес.",
            "Цена отсутствует: полная сумма неизвестна.",
          )}
        </p>
      )}
      {!valid && (
        <p role="alert">
          {tr(lang, "Тауар саны жарамсыз.", "Недопустимое количество.")}
        </p>
      )}
      <div className="modal-actions">
        <button ref={cancel} className="button secondary" onClick={onCancel}>
          {tr(lang, "Бас тарту", "Отмена")}
        </button>
        <button
          className="button primary"
          disabled={!valid}
          onClick={onConfirm}
        >
          {value.bulk
            ? tr(lang, "Иә, барлығын қосу", "Да, добавить всё")
            : tr(lang, "Иә, қосу", "Да, добавить")}
        </button>
      </div>
    </dialog>
  );
}
