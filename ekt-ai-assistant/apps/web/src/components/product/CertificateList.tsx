import { FileCheck2 } from "lucide-react";
import type { Certificate } from "@contract";
import type { Language } from "@/types/ui";
import { safeUrl, tr } from "@/lib/format";
export function CertificateList({
  certificates,
  lang,
}: {
  certificates?: Certificate[];
  lang: Language;
}) {
  if (!certificates?.length) return null;
  return (
    <section className="certificates">
      <h4>{tr(lang, "Сертификаттар", "Сертификаты")}</h4>
      {certificates.map((item, i) =>
        safeUrl(item.url) ? (
          <a
            key={i}
            href={safeUrl(item.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileCheck2 size={16} />
            {item.name}
          </a>
        ) : (
          <p key={i}>
            {item.name} · {tr(lang, "Сілтеме қолжетімсіз", "Ссылка недоступна")}
          </p>
        ),
      )}
    </section>
  );
}
