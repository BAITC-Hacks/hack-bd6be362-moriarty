import { readFile } from "node:fs/promises";
import { EktAgent } from "../src/index.ts";
import { createSnapshotBackend } from "../src/snapshot.ts";

const snapshot = JSON.parse(await readFile(new URL("../data/ekt-snapshot.json", import.meta.url), "utf8"));
const { tools, products } = createSnapshotBackend(snapshot);
const agent = new EktAgent({ tools });
console.log(`FILE CATALOG: ${snapshot.sourceFile} — ${products.length} products. No live API or cart connection.\n`);
for (const text of ["027228", "Алматыда бар ма?", "2 дана керек", "Иә, қос.", "RM17UAS16 бағасы қанша?", "Қалдық қанша?"]) {
  const result = await agent.chat({ sessionId: "file-catalog-demo", text, language: "kk" });
  console.log(`User: ${text}\nAgent: ${result.message}\n`);
}
