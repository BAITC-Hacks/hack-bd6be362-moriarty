"use client";
import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="chat-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Sparkles size={22} />
        <span>AI консультант</span>
        <ArrowUpRight size={19} />
      </button>
      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
