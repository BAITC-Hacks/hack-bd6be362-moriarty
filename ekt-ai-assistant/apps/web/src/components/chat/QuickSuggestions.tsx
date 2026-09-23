import { ArrowUpRight } from "lucide-react";
import type { Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function QuickSuggestions({
  lang,
  disabled,
  onSend,
}: {
  lang: Language;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const prompts =
    lang === "kk"
      ? ["027228 бар ма?", "Алматыда қанша бар?", "Аналог ұсын", "2 дана керек"]
      : [
          "Есть 027228?",
          "Сколько в Алматы?",
          "Предложи аналог",
          "Нужно 2 штуки",
        ];
  return (
    <div
      className="quick-suggestions"
      aria-label={tr(lang, "Жылдам сұрақтар", "Быстрые вопросы")}
    >
      {prompts.map((text) => (
        <button disabled={disabled} key={text} onClick={() => onSend(text)}>
          {text}
          <ArrowUpRight size={13} />
        </button>
      ))}
    </div>
  );
}
