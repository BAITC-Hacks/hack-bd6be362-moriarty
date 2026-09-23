"use client";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "@/types/ui";
import { DEMO_MODE, uploadFile } from "@/lib/api";
export const FILE_ACCEPT = ".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.doc,.docx";
export function useFileUpload() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = controllers.current;
    return () => {
      active.forEach((c) => c.abort());
    };
  }, []);
  function remove(localId: string) {
    controllers.current.get(localId)?.abort();
    controllers.current.delete(localId);
    setAttachments((items) => items.filter((a) => a.localId !== localId));
  }
  async function add(file: File) {
    const localId = crypto.randomUUID();
    const valid =
      /\.(jpe?g|png|pdf|xlsx?|docx?)$/i.test(file.name) &&
      file.size > 0 &&
      file.size <= 20 * 1024 * 1024;
    const item: Attachment = {
      localId,
      name: file.name,
      size: file.size,
      state: valid ? "uploading" : "failed",
      error: valid ? undefined : "JPG, PNG, PDF, Excel, Word · 0–20 MB",
    };
    setAttachments((items) => [...items, item]);
    if (!valid) return;
    const controller = new AbortController();
    controllers.current.set(localId, controller);
    try {
      const response = DEMO_MODE
        ? await new Promise<{ attachmentId: string; status: "processed" }>(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    attachmentId: `demo-${localId}`,
                    status: "processed",
                  }),
                500,
              ),
          )
        : await uploadFile(file, controller.signal);
      if (!controller.signal.aborted)
        setAttachments((items) =>
          items.map((a) =>
            a.localId === localId
              ? {
                  ...a,
                  attachmentId: response.attachmentId,
                  state: "processed",
                }
              : a,
          ),
        );
    } catch (error) {
      if (!controller.signal.aborted)
        setAttachments((items) =>
          items.map((a) =>
            a.localId === localId
              ? {
                  ...a,
                  state: "failed",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : a,
          ),
        );
    } finally {
      controllers.current.delete(localId);
    }
  }
  function consume(ids: string[]) {
    setAttachments((items) => items.filter((a) => !ids.includes(a.localId)));
  }
  return {
    attachments,
    add,
    remove,
    consume,
    isUploading: attachments.some((a) => a.state === "uploading"),
  };
}
