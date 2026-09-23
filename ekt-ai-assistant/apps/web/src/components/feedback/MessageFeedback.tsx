"use client";
import { useRef, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Language } from "@/types/ui";
import { sendFeedback } from "@/lib/api";
import { tr } from "@/lib/format";
export function MessageFeedback({
  messageId,
  lang,
  demo,
}: {
  messageId?: string;
  lang: Language;
  demo: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const busy = useRef(false);
  async function rate(rating: "up" | "down") {
    if (!messageId || busy.current || state === "done") return;
    busy.current = true;
    setState("sending");
    try {
      if (!demo) await sendFeedback(messageId, rating);
      setState("done");
    } catch {
      setState("error");
    } finally {
      busy.current = false;
    }
  }
  return (
    <div className="feedback">
      {state === "done" ? (
        <span role="status">
          {demo ? "Demo · " : ""}
          {tr(lang, "Рахмет!", "Спасибо!")}
        </span>
      ) : (
        <>
          {(["up", "down"] as const).map((rating) => (
            <button
              key={rating}
              className="icon-button"
              disabled={!messageId || state === "sending"}
              title={
                !messageId
                  ? tr(
                      lang,
                      "Backend хабарлама ID-сін бермеді",
                      "Backend не передал ID сообщения",
                    )
                  : undefined
              }
              onClick={() => rate(rating)}
              aria-label={
                rating === "up"
                  ? tr(lang, "Пайдалы жауап", "Полезный ответ")
                  : tr(lang, "Пайдасыз жауап", "Неполезный ответ")
              }
            >
              {rating === "up" ? (
                <ThumbsUp size={14} />
              ) : (
                <ThumbsDown size={14} />
              )}
            </button>
          ))}
          {state === "error" && (
            <span role="status">
              {tr(
                lang,
                "Жіберілмеді. Қайталап көріңіз.",
                "Не отправлено. Попробуйте ещё раз.",
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
}
