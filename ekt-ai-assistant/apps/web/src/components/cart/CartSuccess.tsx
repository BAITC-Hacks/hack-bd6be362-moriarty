import { CheckCircle2, ArrowUpRight } from "lucide-react";
import type { ChatResponse } from "@contract";
import type { Language } from "@/types/ui";
import { safeUrl, tr } from "@/lib/format";
export function CartSuccess({
  cart,
  lang,
  demo,
}: {
  cart: ChatResponse["cart"];
  lang: Language;
  demo: boolean;
}) {
  if (!cart) return null;
  if (!cart.success)
    return (
      <p className="notice warning">
        {tr(
          lang,
          "Корзинаға қосылмады. Жауапты тексеріңіз.",
          "Не добавлено в корзину. Проверьте ответ.",
        )}
      </p>
    );
  return (
    <div className="cart-success">
      <CheckCircle2 size={23} />
      <div>
        <strong>
          {demo ? "Demo · " : ""}
          {tr(lang, "Корзинаға қосылды", "Добавлено в корзину")}
        </strong>
        {demo && (
          <p>
            {tr(
              lang,
              "Көрсетілім ғана. Нақты корзина өзгермеді.",
              "Только демонстрация. Реальная корзина не изменена.",
            )}
          </p>
        )}
        {safeUrl(cart.cartUrl) && (
          <a
            href={safeUrl(cart.cartUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr(lang, "Корзинаға өту", "Перейти в корзину")}{" "}
            <ArrowUpRight size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
