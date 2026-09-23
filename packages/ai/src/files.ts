import type { SpecificationRow } from "../../shared/types.ts";
import type { Attachment, FileExtractor } from "./contracts.ts";
import { validQuantity } from "./reasoning.ts";

const mimeTypes = new Set([
  "image/jpeg", "image/png", "application/pdf", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/csv",
]);
export function isSuspiciousFileText(text: string): boolean {
  return /ignore\s+(?:all\s+|previous\s+)?instructions|system\s*prompt|add\s+to\s+cart|confirm|игнорир|подтвержд|добав[ьи].*корзин|растаймын|иә[,\s]+қос|корзинаға\s+қос|себетке\s+қос/i.test(text);
}
export function validateRows(rows: SpecificationRow[]): SpecificationRow[] {
  if (!Array.isArray(rows) || !rows.length || rows.length > 200) throw new Error("Invalid row count");
  return rows.map(row => {
    if (!row || typeof row.query !== "string" || !row.query.trim() || row.query.length > 2000 || !validQuantity(row.requestedQty)) throw new Error("Invalid specification row");
    return { query: row.query.trim(), requestedQty: row.requestedQty };
  });
}
/** Simple extracted text format: one query per line; optional TAB/semicolon + quantity. */
export function rowsFromText(text: string): SpecificationRow[] {
  if (text.length > 100000) throw new Error("Extracted text too large");
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows = lines.filter(line => !/^(query|артикул|тауар|наименование)[\t;](quantity|qty|саны|количество)$/i.test(line)).map(line => {
    const columns = line.split(/[\t;]/);
    const last = columns[columns.length - 1]!.trim();
    if (columns.length > 1 && /^-?\d+(?:[.,]\d+)?$/.test(last)) {
      return { query: columns.slice(0, -1).join(" ").trim(), requestedQty: Number(last.replace(",", ".")) };
    }
    const qty = line.match(/^(.*?)\s+(\d+)\s*(?:шт\.?|штук[аи]?|дана)$/i);
    return qty ? { query: qty[1]!.trim(), requestedQty: Number(qty[2]) } : { query: line, requestedQty: 1 };
  });
  return validateRows(rows);
}
export async function extractRows(file: Attachment, extractor?: FileExtractor): Promise<SpecificationRow[]> {
  if (!mimeTypes.has(file.mimeType) || file.name.length > 255 || (file.bytes?.length ?? 0) > 10 * 1024 * 1024) throw new Error("Unsupported attachment");
  let result = file.extracted;
  if (!result && file.bytes && ["text/plain", "text/csv"].includes(file.mimeType)) {
    result = { success: true, text: new TextDecoder("utf-8", { fatal: true }).decode(file.bytes) };
  }
  const extracted = result ?? (extractor ? await extractor.extract(file) : { success: false });
  if (!extracted.success) throw new Error("Extraction failed");
  if (extracted.rows) return validateRows(extracted.rows);
  if (typeof extracted.text !== "string") throw new Error("No extracted content");
  return rowsFromText(extracted.text);
}
