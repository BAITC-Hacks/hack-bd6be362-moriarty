"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import type { DemoScenario, Language } from "@/types/ui";
import { DEMO_MODE } from "@/lib/api";
import { tr } from "@/lib/format";
import { useChat } from "@/hooks/useChat";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ConfirmationModal } from "@/components/cart/ConfirmationModal";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { QuickSuggestions } from "./QuickSuggestions";
export function ChatPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<Language>("kk");
  const chat = useChat();
  const files = useFileUpload();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open) {
      element?.showModal();
    } else element?.close();
    return () => {
      element?.close();
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      const previous = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = previous;
      };
    }
  }, [open]);
  async function send(text: string) {
    if (
      files.isUploading ||
      files.attachments.some((a) => a.state !== "processed")
    )
      return false;
    const attached = [...files.attachments];
    const success = await chat.send(text, attached);
    if (success) files.consume(attached.map((a) => a.localId));
    return success;
  }
  return (
    <dialog
      ref={dialog}
      lang={lang}
      className="chat-panel"
      aria-label="EKT AI консультант"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <ChatHeader
        lang={lang}
        setLang={setLang}
        onClose={onClose}
        demo={DEMO_MODE}
        connected={
          !chat.error && chat.messages.some((m) => m.role === "assistant")
        }
      />
      <div className="trust-bar">
        <ShieldCheck size={14} />
        <span>
          {tr(
            lang,
            "Каталог · Қойма қалдығы · Салыстыру",
            "Каталог · Наличие · Сравнение",
          )}
        </span>
        <span className="trust-tag">HACKALEM AI</span>
      </div>
      {DEMO_MODE && (
        <div className="demo-toolbar">
          <strong>Demo</strong>
          <span>
            {tr(
              lang,
              "Үлгі деректер. Нақты EKT емес.",
              "Пример данных. Не live EKT.",
            )}
          </span>
          <label className="sr-only" htmlFor="demo-scenario">
            Demo scenario
          </label>
          <select
            id="demo-scenario"
            value={chat.scenario}
            disabled={chat.isSending}
            onChange={(e) => chat.setScenario(e.target.value as DemoScenario)}
          >
            {(
              [
                "product",
                "stock",
                "analog",
                "cart",
                "estimate",
                "compare",
                "warning",
                "missing",
                "error",
              ] as DemoScenario[]
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      <MessageList
        messages={chat.messages}
        lang={lang}
        busy={chat.isSending}
        demo={DEMO_MODE}
        uploading={files.isUploading}
        onConfirm={chat.setPendingConfirmation}
        onSend={(text) => {
          void send(text);
        }}
      />
      {chat.error && (
        <div className="chat-error" role="alert">
          <AlertCircle size={17} />
          <div>
            <strong>
              {tr(
                lang,
                "Жауап алу кезінде қате шықты.",
                "Ошибка при получении ответа.",
              )}
            </strong>
            <p>{chat.error}</p>
            <p>
              {chat.uncertain
                ? tr(
                    lang,
                    "Әрекет нәтижесі белгісіз. Қайта растамас бұрын корзинаны тексеріңіз.",
                    "Результат действия неизвестен. Проверьте корзину перед повторным подтверждением.",
                  )
                : tr(
                    lang,
                    "Хабарламаны қайта жіберіп көріңіз.",
                    "Попробуйте отправить сообщение ещё раз.",
                  )}
            </p>
          </div>
        </div>
      )}
      <QuickSuggestions
        lang={lang}
        disabled={
          chat.isSending ||
          files.isUploading ||
          files.attachments.some((a) => a.state === "failed")
        }
        onSend={(text) => {
          void send(text);
        }}
      />
      <MessageComposer
        lang={lang}
        busy={chat.isSending}
        files={files}
        onSend={send}
        demo={DEMO_MODE}
      />
      <ConfirmationModal
        value={chat.pendingConfirmation}
        lang={lang}
        onCancel={() => chat.setPendingConfirmation(null)}
        onConfirm={() => {
          void chat.confirm();
        }}
      />
    </dialog>
  );
}
