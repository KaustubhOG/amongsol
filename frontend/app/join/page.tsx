"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import socket from "@/lib/socket";
import { connectSolanaWallet } from "@/lib/solana";

export default function JoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("enter a room code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const wallet = await connectSolanaWallet();
      socket.setWallet(wallet);
      await socket.joinGame(code, wallet);
      router.push(`/lobby/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to join room");
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <section className="space-panel w-full max-w-xl p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-2">
            <span className="space-title text-xs font-bold" style={{ color: "#ff6666" }}>
              join game
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Enter room code</h1>
            <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
              The wallet is handled automatically. You only need the room code.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              className="wood-input w-full px-4 py-4 text-center text-xl font-bold uppercase tracking-[0.35em] outline-none"
              spellCheck={false}
              maxLength={12}
            />

            <button
              onClick={handleJoin}
              disabled={loading}
              className="hover-lift wood-button w-full px-5 py-4 text-sm font-bold tracking-[0.25em] uppercase disabled:opacity-50"
              style={{ color: "var(--green)" }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  joining...
                </span>
              ) : (
                "Join Room"
              )}
            </button>

            {error && (
              <div className="wood-panel-soft px-4 py-3 text-xs" style={{ borderColor: "#ff4444", color: "#ff6666" }}>
                {error}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
