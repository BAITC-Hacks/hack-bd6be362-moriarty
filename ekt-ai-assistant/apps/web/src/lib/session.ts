let fallback: string | undefined;
export function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem("hackalem-session");
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem("hackalem-session", id);
    return id;
  } catch {
    return (fallback ??= crypto.randomUUID());
  }
}
