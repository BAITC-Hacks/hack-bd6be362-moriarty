"use client";
import { useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import type { Language } from "@/types/ui";
import type { useFileUpload } from "@/hooks/useFileUpload";
import { tr } from "@/lib/format";
import { FileUploader } from "@/components/files/FileUploader";
import { FileAttachmentPreview } from "@/components/files/FileAttachmentPreview";
export function MessageComposer({
  lang,
  busy,
  files,
  onSend,
  demo,
}: {
  lang: Language;
  busy: boolean;
  files: ReturnType<typeof useFileUpload>;
  onSend: (text: string) => Promise<boolean>;
  demo: boolean;
}) {
  const [text, setText] = useState("");
  const blocked =
    busy ||
    files.isUploading ||
    files.attachments.some((a) => a.state === "failed");
  async function submit() {
    if (blocked || (!text.trim() && !files.attachments.length)) return;
    if (await onSend(text.trim())) setText("");
  }
  return (
    <footer className="composer-area">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!!files.attachments.length && (
          <div className="attachments">
            {files.attachments.map((a) => (
              <FileAttachmentPreview
                key={a.localId}
                attachment={a}
                lang={lang}
                demo={demo}
                disabled={busy}
                onRemove={() => files.remove(a.localId)}
              />
            ))}
          </div>
        )}
        <div className="composer">
          <label className="sr-only" htmlFor="chat-message">
            {tr(lang, "Хабарлама", "Сообщение")}
          </label>
          <textarea
            id="chat-message"
            value={text}
            maxLength={6000}
            disabled={busy}
            placeholder={tr(
              lang,
              "Тауарды, артикулды немесе сұрағыңызды жазыңыз...",
              "Напишите товар, артикул или ваш вопрос...",
            )}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="composer-tools">
            <div>
              <FileUploader
                lang={lang}
                disabled={busy || files.attachments.length >= 5}
                onFile={files.add}
              />
              <span>PDF, Excel, Word, JPG, PNG</span>
            </div>
            <button
              className="send-button"
              type="submit"
              aria-label={tr(lang, "Жіберу", "Отправить")}
              disabled={blocked || (!text.trim() && !files.attachments.length)}
            >
              {busy ? (
                <LoaderCircle size={19} className="spin" />
              ) : (
                <ArrowUp size={22} />
              )}
            </button>
          </div>
        </div>
        <p className="composer-hint">
          {tr(
            lang,
            "Excel/PDF спецификация жүктеп, тізімдегі тауарларды бірден тексертіп, есеп ала аласыз.",
            "Загрузите спецификацию Excel/PDF, чтобы проверить товары и получить расчёт.",
          )}
        </p>
      </form>
      <div className="composer-footer">
        <span>
          HACKALEM <b>AI</b>
        </span>
        <span>
          {tr(
            lang,
            "Қосу алдында әрқашан растайсыз",
            "Добавление только с подтверждением",
          )}
        </span>
      </div>
    </footer>
  );
}
