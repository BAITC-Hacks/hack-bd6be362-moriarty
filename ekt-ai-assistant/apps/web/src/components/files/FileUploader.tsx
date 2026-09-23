"use client";
import { useRef } from "react";
import { Paperclip } from "lucide-react";
import type { Language } from "@/types/ui";
import { FILE_ACCEPT } from "@/hooks/useFileUpload";
import { tr } from "@/lib/format";
export function FileUploader({
  lang,
  disabled,
  onFile,
}: {
  lang: Language;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept={FILE_ACCEPT}
        aria-label={tr(lang, "Файл таңдау", "Выбрать файл")}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={tr(lang, "Файл тіркеу", "Прикрепить файл")}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Paperclip size={20} />
      </button>
    </>
  );
}
