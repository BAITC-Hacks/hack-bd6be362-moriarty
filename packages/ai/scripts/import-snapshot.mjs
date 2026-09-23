import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename } from "node:path";
import { parseEktExport, createSnapshotBackend } from "../src/snapshot.ts";

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run import:catalog -- "C:\\path\\11.txt"');
const snapshot = parseEktExport(await readFile(input, "utf8"), basename(input), new Date().toISOString());
const { products } = createSnapshotBackend(snapshot); // validate before writing
const directory = new URL("../data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("ekt-snapshot.json", directory), JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`Imported ${snapshot.pages.length} pages, ${products.length} products, ${snapshot.details.length} details from ${snapshot.sourceFile}.`);
console.log("File snapshot only; import time is not API freshness. No network requests made.");
