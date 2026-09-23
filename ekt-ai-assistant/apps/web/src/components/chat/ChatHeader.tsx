import { Sparkles, X } from "lucide-react";
import type { Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function ChatHeader({
  lang,
  setLang,
  onClose,
  demo,
  connected,
}: {
  lang: Language;
  setLang: (lang: Language) => void;
  onClose: () => void;
  demo: boolean;
  connected: boolean;
}) {
  return (
    <header className="chat-header">
      <span className="assistant-logo">
        <Sparkles size={22} />
      </span>
      <div className="chat-title">
        <strong>EKT AI консультант</strong>
        <span>
          <i
            className={connected || demo ? "status-dot active" : "status-dot"}
          />
          {demo
            ? "Demo"
            : connected
              ? tr(lang, "Онлайн", "Онлайн")
              : tr(lang, "Қосылуға дайын", "Готов к подключению")}{" "}
          · {tr(lang, "AI көмекші", "AI помощник")}
        </span>
      </div>
      <div className="language-switch" aria-label={tr(lang, "Тіл", "Язык")}>
        <button aria-pressed={lang === "kk"} onClick={() => setLang("kk")}>
          ҚАЗ
        </button>
        <button aria-pressed={lang === "ru"} onClick={() => setLang("ru")}>
          РУС
        </button>
      </div>
      <button
        className="icon-button close-chat"
        onClick={onClose}
        aria-label={tr(lang, "Чатты жабу", "Закрыть чат")}
      >
        <X size={21} />
      </button>
    </header>
  );
}
