import { AlertTriangle } from "lucide-react";
import type { DataQualityWarning } from "@contract";
import type { Language } from "@/types/ui";
import { tr } from "@/lib/format";
export function DataWarning({
  warnings,
  lang,
}: {
  warnings?: DataQualityWarning[];
  lang: Language;
}) {
  if (!warnings?.length) return null;
  return (
    <aside className="notice warning">
      <AlertTriangle size={17} />
      <div>
        <strong>
          {tr(
            lang,
            "Каталог деректерінде сәйкессіздік табылды.",
            "В данных каталога обнаружено расхождение.",
          )}
        </strong>
        {warnings.map((w, i) => (
          <div key={i}>
            <p>{w.message}</p>
            {w.sources && (
              <dl>
                {Object.entries(w.sources).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
