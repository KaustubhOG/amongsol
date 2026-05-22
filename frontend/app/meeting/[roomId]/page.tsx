"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface EditInfo {
  cursor_color: string;
  function_name: string;
  timestamp: number;
  result: string;
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [editHistory, setEditHistory] = useState<EditInfo[]>([]);
  const [chat, setChat] = useState("");

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "MeetingCalled") {
        setEditHistory(msg.edit_history as EditInfo[]);
      }
      if (msg.type === "GameOver") {
        router.push(`/results/${roomId}`);
      }
    });
    return unsub;
  }, [roomId, router]);

  function handleVote() {
    router.push(`/vote/${roomId}`);
  }

  function formatTime(ts: number) {
    const d = new Date(ts * 1000);
    return `${d.getMinutes()}:${d.getSeconds().toString().padStart(2, "0")}`;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-2xl font-bold" style={{ color: "#ff4444" }}>
          Emergency Meeting
        </h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          discuss and vote · 30 seconds
        </p>
      </div>

      <div className="w-96 flex flex-col gap-2">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "var(--muted)" }}
        >
          Edit History
        </p>
        {editHistory.length === 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            no edits recorded
          </p>
        )}
        {editHistory.map((entry, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3 border text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.cursor_color }}
              />
              <span style={{ color: "var(--muted)" }}>[{formatTime(entry.timestamp)}]</span>
            </div>
            <span>{entry.function_name}</span>
            <span style={{ color: entry.result === "pass" ? "var(--green)" : "#ff4444" }}>
              {entry.result}
            </span>
          </div>
        ))}
      </div>

      <div className="w-96 flex flex-col gap-2">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "var(--muted)" }}
        >
          Chat
        </p>
        <div
          className="w-full h-32 border p-3 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          use voice or discord to discuss
        </div>
        <input
          type="text"
          placeholder="type a message..."
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          className="w-full bg-transparent border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>

      <button
        onClick={handleVote}
        className="w-96 py-3 border text-sm font-bold tracking-widest uppercase"
        style={{ borderColor: "#ff4444", color: "#ff4444" }}
      >
        Proceed to Vote
      </button>
    </main>
  );
}