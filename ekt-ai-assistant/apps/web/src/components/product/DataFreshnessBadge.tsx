import { Clock3 } from "lucide-react";
import type { DataFreshness, Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function DataFreshnessBadge({
  data,
  lang,
}: {
  data?: DataFreshness;
  lang: Language;
}) {
  if (
    !data ||
    (data.updatedAt == null &&
      data.cacheAgeSeconds == null &&
      data.stale == null)
  )
    return null;
  const label =
    data.cacheAgeSeconds != null
      ? `${Math.floor(data.cacheAgeSeconds / 60)} ${tr(lang, "мин бұрын жаңартылды", "мин. назад обновлено")}`
      : data.updatedAt
        ? new Date(data.updatedAt).toLocaleString(
            lang === "kk" ? "kk-KZ" : "ru-KZ",
          )
        : tr(lang, "Деректер күйі", "Состояние данных");
  return (
    <span
      className={`freshness ${data.stale ? "stale" : ""}`}
      title={
        data.stale
          ? tr(
              lang,
              "Деректер сәл ескіруі мүмкін",
              "Данные могут быть устаревшими",
            )
          : undefined
      }
    >
      <Clock3 size={13} />
      {label}
      {data.stale && ` · ${tr(lang, "Ескірген", "Устарели")}`}
    </span>
  );
}
