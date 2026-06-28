"use client";

import { ReactNode, useState } from "react";
import sound from "@/lib/sound";

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
      sound.play("click");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel rise-in flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-3">
        <span className="eyebrow" style={{ color: accent }}>
          {badge}
        </span>
        <h1 className="title text-3xl sm:text-4xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
          <span>{description}</span>
          <span className="chip font-mono">
            <span style={{ color: "var(--faint)" }}>ROOM</span>
            <span style={{ color: "var(--text)", letterSpacing: "0.12em" }}>{roomId}</span>
            <button
              onClick={handleCopy}
              className="hover-lift"
              style={{
                borderRadius: "999px",
                border: "1px solid var(--panel-line-strong)",
                padding: "0.1rem 0.55rem",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: accent,
                background: "rgba(8,12,28,0.6)",
              }}
              type="button"
              aria-label={`Copy room id ${roomId}`}
              title="Copy room id"
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
