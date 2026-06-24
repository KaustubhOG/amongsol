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
    <div className="space-panel flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <span className="space-title text-xs font-bold" style={{ color: accent }}>
          {badge}
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <span>{description}</span>
          <span className="wood-chip inline-flex items-center gap-2 px-2 py-1 text-xs">
            <span style={{ color: "var(--muted)" }}>room</span>
            <span>{roomId}</span>
            <button
              onClick={handleCopy}
              className="hover-lift wood-button px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
              style={{ color: accent }}
              type="button"
              aria-label={`Copy room id ${roomId}`}
              title="Copy room id"
            >
              {copied ? "copied" : "copy"}
            </button>
          </span>
        </div>
      </div>

      {action && <div className="shrink-0 lg:pt-1">{action}</div>}
    </div>
  );
}
