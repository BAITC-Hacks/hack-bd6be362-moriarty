import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "HACKALEM AI — EKT консультант",
  description:
    "Электротехника таңдаудағы AI көмекшіңіз. Тауарлар, қалдықтар, аналогтар және спецификация.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="kk">
      <body>{children}</body>
    </html>
  );
}
