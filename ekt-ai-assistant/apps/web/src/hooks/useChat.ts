"use client";
import { useEffect, useRef, useState } from "react";
import type {
  Attachment,
  ChatMessage,
  DemoScenario,
  PendingConfirmation,
  ResponseView,
} from "@/types/ui";
import { DEMO_MODE, sendChatMessage } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { demoReply } from "@/demo/demoResponses";
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [scenario, setScenario] = useState<DemoScenario>("product");
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function send(
    text: string,
    attachments: Attachment[] = [],
    confirmation = false,
  ) {
    if (busy.current || (!text.trim() && !attachments.length)) return false;
    busy.current = true;
    setSending(true);
    setError(null);
    setUncertain(false);
    setPendingConfirmation(null);
    const active = new AbortController();
    controller.current = active;
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "user",
        text,
        attachmentNames: attachments.map((a) => a.name),
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const response: ResponseView = DEMO_MODE
        ? await demoReply(scenario, confirmation)
        : await sendChatMessage(
            {
              sessionId: getSessionId(),
              message: text,
              attachmentIds: attachments.flatMap((a) =>
                a.attachmentId ? [a.attachmentId] : [],
              ),
            },
            active.signal,
          );
      if (active.signal.aborted) return false;
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.message,
          response,
          createdAt: new Date().toISOString(),
        },
      ]);
      return true;
    } catch (err) {
      if (!active.signal.aborted) {
        setError(err instanceof Error ? err.message : "Backend unavailable");
        setUncertain(confirmation);
      }
      return false;
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  async function confirm() {
    if (!pendingConfirmation || busy.current) return;
    const value = pendingConfirmation;
    // Existing agreed chat envelope only. Person #2 must interpret explicit confirmation
    // and bind it to server-side pending action/session. No frontend cart mutation.
    const text = `Иә, қосу / Да, добавить в корзину: ${value.items.map((i) => `${i.name} (productId: ${i.productId}), ${i.quantity} дана / шт.`).join("; ")}.`;
    await send(text, [], true);
  }
  return {
    messages,
    isSending,
    error,
    uncertain,
    pendingConfirmation,
    setPendingConfirmation,
    scenario,
    setScenario,
    send,
    confirm,
  };
}
