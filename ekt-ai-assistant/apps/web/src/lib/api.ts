import type { ResponseView } from "@/types/ui";
import { chatSchema, extensionSchema, uploadSchema } from "./validation";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const EXTENSIONS = process.env.NEXT_PUBLIC_UI_EXTENSIONS === "true";
export type ChatRequest = {
  sessionId: string;
  message: string;
  attachmentIds: string[];
};
function endpoint(path: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  if (base) {
    const url = new URL(base);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      /(^|\.)ekt\.kz$/i.test(url.hostname.replace(/\.$/, "")) ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "Configure the application backend origin, without credentials.",
      );
    }
  }
  return `${base}${path}`;
}
async function request(
  path: string,
  body: unknown,
  signal?: AbortSignal,
  form = false,
) {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form ? (body as FormData) : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
    credentials: "same-origin",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const error = await response.json();
      if (typeof error.message === "string")
        detail = error.message.slice(0, 800);
    } catch {
      /* non-JSON response */
    }
    throw new Error(detail || `Backend unavailable (HTTP ${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}
export async function sendChatMessage(
  input: ChatRequest,
  signal?: AbortSignal,
): Promise<ResponseView> {
  const raw = await request("/api/chat", input, signal);
  const result = chatSchema.safeParse(raw);
  if (!result.success)
    throw new Error("Backend response does not match ChatResponse.");
  const extra = EXTENSIONS ? extensionSchema.safeParse(raw) : null;
  if (extra && !extra.success)
    throw new Error("Backend UI extension response is invalid.");
  return { ...result.data, ...(extra?.success ? extra.data : {}) };
}
export async function uploadFile(file: File, signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", file);
  const raw = await request("/api/files", form, signal, true);
  const parsed = uploadSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      "Файлдан дерек оқу мүмкін болмады / Не удалось подтвердить обработку файла.",
    );
  return parsed.data;
}
export async function sendFeedback(messageId: string, rating: "up" | "down") {
  await request("/api/feedback", { messageId, rating });
}
