import { FileText, X, LoaderCircle } from "lucide-react";
import type { Attachment, Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function FileAttachmentPreview({
  attachment,
  lang,
  onRemove,
  disabled,
  demo,
}: {
  attachment: Attachment;
  lang: Language;
  onRemove: () => void;
  disabled: boolean;
  demo: boolean;
}) {
  const label =
    attachment.state === "uploading"
      ? tr(lang, "Файл жүктеліп жатыр...", "Файл загружается...")
      : attachment.state === "processed"
        ? demo
          ? tr(
              lang,
              "Demo · үлгі дайын, файл оқылмады",
              "Demo · пример готов, файл не прочитан",
            )
          : tr(lang, "Файл өңделді", "Файл обработан")
        : tr(
            lang,
            "Файлдан дерек оқу мүмкін болмады",
            "Не удалось прочитать файл",
          );
  return (
    <div className={`attachment ${attachment.state}`}>
      <FileText size={19} />
      <div>
        <strong>{attachment.name}</strong>
        <span>
          {Math.max(1, Math.ceil(attachment.size / 1024))} KB · {label}
        </span>
        {attachment.error && (
          <span className="field-error">{attachment.error}</span>
        )}
      </div>
      {attachment.state === "uploading" && (
        <LoaderCircle className="spin" size={16} />
      )}
      <button
        type="button"
        className="icon-button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`${tr(lang, "Жою", "Удалить")}: ${attachment.name}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
