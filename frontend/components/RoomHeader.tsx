"use client";

import { ReactNode, useState } from "react";

interface RoomHeaderProps {
  badge: string;
  title: string;
  description: string;
  roomId: string;
  accent: string;
  action?: ReactNode;
}

export default function RoomHeader({ badge, title, description, roomId, accent, action }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-6 border-b pb-5" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>
          {badge}
        </span>
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <span>{description}</span>
          <span className="inline-flex items-center gap-2 border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--muted)" }}>room</span>
            <span>{roomId}</span>
            <button
              onClick={handleCopy}
              className="hover-lift border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
              style={{ borderColor: accent, color: accent }}
              type="button"
            >
              {copied ? "copied" : "copy"}
            </button>
          </span>
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
