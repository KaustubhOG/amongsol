"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import socket from "@/lib/socket";

export default function Home() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!wallet.trim()) {
      setError("enter a wallet address");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8080/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      const data = await res.json();
      await socket.connectAndWait(wallet.trim());
      socket.send({ type: "JoinGame", game_id: data.game_id, wallet: wallet.trim() });
      router.push(`/lobby/${data.game_id}`);
    } catch {
      setError("failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!wallet.trim()) {
      setError("enter a wallet address");
      return;
    }
    if (!roomId.trim()) {
      setError("enter a room id");
      return;
    }
    setLoading(true);
    try {
      await socket.connectAndWait(wallet.trim());
      socket.send({ type: "JoinGame", game_id: roomId.trim().toUpperCase(), wallet: wallet.trim() });
      router.push(`/lobby/${roomId.trim().toUpperCase()}`);
    } catch {
      setError("failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-bold tracking-tight" style={{ color: "var(--green)" }}>
          SolSabotage
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Fix code. Find the traitor. Win SOL.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-80">
        <input
          type="text"
          placeholder="your wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          className="w-full bg-transparent border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-3 border text-sm font-bold tracking-widest uppercase"
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          {loading ? "connecting..." : "Create Game"}
        </button>

        <div className="flex flex-col gap-2 p-4 border" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            or join a game
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ROOM ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 bg-transparent border px-3 py-2 text-sm outline-none uppercase tracking-widest"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
            <button
              onClick={handleJoin}
              className="px-4 py-2 text-sm font-bold tracking-widest uppercase"
              style={{ backgroundColor: "var(--green)", color: "#0f0f0f" }}
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-center" style={{ color: "#ff4444" }}>
            {error}
          </p>
        )}

        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          3 - 4 players · find the impostor
        </p>
      </div>
    </main>
  );
}