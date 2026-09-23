import { Sparkles } from "lucide-react";
import type { ChatMessage, Language, PendingConfirmation } from "@/types/ui";
import { ProductCard } from "@/components/product/ProductCard";
import { AnalogCard } from "@/components/product/AnalogCard";
import { DataWarning } from "@/components/product/DataWarning";
import { DataFreshnessBadge } from "@/components/product/DataFreshnessBadge";
import { SpecEstimateView } from "@/components/estimate/SpecEstimateView";
import { ProductCompareView } from "@/components/compare/ProductCompareView";
import { CartSuccess } from "@/components/cart/CartSuccess";
import { MessageFeedback } from "@/components/feedback/MessageFeedback";
import { tr } from "@/lib/format";
export function MessageBubble({
  message,
  lang,
  demo,
  busy,
  latest,
  onConfirm,
}: {
  message: ChatMessage;
  lang: Language;
  demo: boolean;
  busy: boolean;
  latest: boolean;
  onConfirm: (value: PendingConfirmation) => void;
}) {
  const response = message.response;
  const pending = response?.pendingAction;
  const product = response?.products?.find((p) => p.id === pending?.productId);
  return (
    <article className={`message ${message.role}`}>
      <div className="message-byline">
        {message.role === "assistant" && <Sparkles size={14} />}
        <strong>
          {message.role === "assistant" ? "EKT AI" : tr(lang, "Сіз", "Вы")}
        </strong>
      </div>
      <div className="message-text">{message.text}</div>
      {message.attachmentNames?.map((name, i) => (
        <div key={i} className="sent-attachment">
          ↳ {name}
        </div>
      ))}
      {response && (
        <>
          <DataWarning warnings={response.warnings} lang={lang} />
          <DataFreshnessBadge data={response.freshness} lang={lang} />
          <div className="result-stack">
            {response.products?.map((p, i) => (
              <ProductCard
                key={i}
                product={p}
                lang={lang}
                disabled={busy}
                onConfirm={onConfirm}
              />
            ))}
            {response.analogs?.map((analog, i) => (
              <AnalogCard
                key={i}
                analog={analog}
                lang={lang}
                disabled={busy}
                onConfirm={onConfirm}
              />
            ))}
            {response.estimate && (
              <SpecEstimateView
                estimate={response.estimate}
                lang={lang}
                bulkEnabled={demo}
                disabled={busy}
                onConfirm={onConfirm}
              />
            )}{" "}
            {!!response.comparison?.length && (
              <ProductCompareView products={response.comparison} lang={lang} />
            )}
          </div>
          {pending && latest && (
            <button
              className="button primary pending-action"
              disabled={busy}
              onClick={() =>
                onConfirm({
                  items: [
                    {
                      productId: pending.productId,
                      name: product?.name ?? `ID ${pending.productId}`,
                      quantity: pending.quantity,
                      price: product?.price ?? null,
                    },
                  ],
                })
              }
            >
              {tr(lang, "Қосуды растау", "Подтвердить добавление")} ·{" "}
              {pending.quantity}
            </button>
          )}
          {response.estimate?.rows.map((row, i) =>
            row.product?.dataQualityWarnings?.length ? (
              <div key={i}>
                <strong>{row.product.name}</strong>
                <DataWarning
                  warnings={row.product.dataQualityWarnings}
                  lang={lang}
                />
              </div>
            ) : null,
          )}
          <CartSuccess cart={response.cart} lang={lang} demo={demo} />
          <MessageFeedback
            messageId={response.messageId}
            lang={lang}
            demo={demo}
          />
        </>
      )}
    </article>
  );
}
