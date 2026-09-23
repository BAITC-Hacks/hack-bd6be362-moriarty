import { Check, ArrowLeftRight } from "lucide-react";
import type { Analog } from "@/types/ui";
import { tr } from "@/lib/format";
import { ProductCard, type ProductCardProps } from "./ProductCard";
export function AnalogCard({
  analog,
  ...props
}: Omit<ProductCardProps, "product"> & { analog: Analog }) {
  return (
    <section className="analog-card">
      <div className="section-caption">
        <ArrowLeftRight size={15} />
        {tr(props.lang, "Ұқсас тауар", "Аналог")}
      </div>
      <ProductCard product={analog.product} {...props} />
      <div className="analog-reasons">
        <h4>{tr(props.lang, "Неге ұсынылды", "Почему рекомендован")}</h4>
        {analog.reasons.map((text, i) => (
          <p key={i}>
            <Check size={15} />
            {text}
          </p>
        ))}
        <h4>{tr(props.lang, "Айырмашылығы", "Отличия")}</h4>
        {analog.differences.length ? (
          analog.differences.map((text, i) => <p key={i}>⚠ {text}</p>)
        ) : (
          <p>
            {tr(
              props.lang,
              "Айырмашылықтар берілмеген",
              "Различия не предоставлены",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
