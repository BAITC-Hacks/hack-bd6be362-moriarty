"use client";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Box,
  FileSpreadsheet,
  Layers3,
  Sparkles,
} from "lucide-react";
import type { ChatMessage, Language, PendingConfirmation } from "@/types/ui";
import { tr } from "@/lib/format";
import { MessageBubble } from "./MessageBubble";
export function MessageList({
  messages,
  lang,
  busy,
  demo,
  uploading,
  onConfirm,
  onSend,
}: {
  messages: ChatMessage[];
  lang: Language;
  busy: boolean;
  demo: boolean;
  uploading: boolean;
  onConfirm: (value: PendingConfirmation) => void;
  onSend: (text: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [messages, busy]);
  return (
    <div
      className="message-list"
      role="log"
      aria-label={tr(lang, "Хабарламалар", "Сообщения")}
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 ? (
        <div className="welcome">
          <div className="welcome-mark">
            <Sparkles size={31} strokeWidth={1.5} />
            <span className="orbit one" />
            <span className="orbit two" />
          </div>
          <span className="eyebrow">
            {tr(
              lang,
              "ЭЛЕКТРОТЕХНИКАДАҒЫ КӨМЕКШІҢІЗ",
              "ВАШ ПОМОЩНИК В ЭЛЕКТРОТЕХНИКЕ",
            )}
          </span>
          <h2>
            {tr(
              lang,
              "Сәлем! Қалай көмектесейін?",
              "Здравствуйте! Чем помочь?",
            )}
          </h2>
          <p>
            {tr(
              lang,
              "Қажетті тауарды табуға, қалдықты тексеруге және баламаларды салыстыруға көмектесемін.",
              "Помогу найти нужный товар, проверить наличие и сравнить альтернативы.",
            )}
          </p>
          <div className="welcome-actions">
            {[
              {
                icon: Box,
                title: tr(lang, "Тауар табу", "Найти товар"),
                subtitle: tr(
                  lang,
                  "Атауы немесе артикулы бойынша",
                  "По названию или артикулу",
                ),
                message: tr(
                  lang,
                  "Маған Legrand 160A үш фазалы автомат керек",
                  "Мне нужен трёхфазный автомат Legrand 160A",
                ),
              },
              {
                icon: Layers3,
                title: tr(lang, "Аналог таңдау", "Подобрать аналог"),
                subtitle: tr(
                  lang,
                  "Параметрлерін салыстырыңыз",
                  "Сравните характеристики",
                ),
                message: tr(
                  lang,
                  "027228 үшін аналог ұсын",
                  "Предложи аналог для 027228",
                ),
              },
              {
                icon: FileSpreadsheet,
                title: tr(lang, "Сатып алу шарттары", "Условия покупки"),
                subtitle: tr(
                  lang,
                  "Төлем, жеткізу және құжаттар",
                  "Оплата, доставка и документы",
                ),
                message: tr(
                  lang,
                  "Сатып алу шарттары қандай?",
                  "Какие условия покупки?",
                ),
              },
            ].map((item) => (
              <button
                key={item.title}
                disabled={busy || uploading}
                onClick={() => onSend(item.message)}
              >
                <span className="welcome-action-icon">
                  <item.icon size={21} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
          <div className="welcome-note">
            <span className="small-dot" />
            {tr(
              lang,
              "Сұрағыңызды өзіңізге ыңғайлы тілде жазыңыз",
              "Задайте вопрос на удобном вам языке",
            )}
          </div>
        </div>
      ) : (
        messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            lang={lang}
            demo={demo}
            busy={busy}
            latest={i === messages.length - 1}
            onConfirm={onConfirm}
          />
        ))
      )}
      {busy && (
        <div className="loading-response" role="status">
          <span className="typing-dots">
            <i />
            <i />
            <i />
          </span>
          {tr(lang, "Жауап күтіп жатырмын...", "Ожидаю ответ...")}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
