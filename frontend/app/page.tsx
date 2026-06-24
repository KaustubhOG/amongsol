"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import socket from "@/lib/socket";

export default function Home() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"create" | "join" | null>(null);

  async function handleCreate() {
    if (!wallet.trim()) {
      setError("enter a wallet address");
      return;
    }
    setLoadingAction("create");
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
      setLoadingAction(null);
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
    setLoadingAction("join");
    try {
      await socket.connectAndWait(wallet.trim());
      socket.send({ type: "JoinGame", game_id: roomId.trim().toUpperCase(), wallet: wallet.trim() });
      router.push(`/lobby/${roomId.trim().toUpperCase()}`);
    } catch {
      setError("failed to connect to server");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-8">
        <div className="wood-panel flex w-full max-w-2xl flex-col items-center gap-5 p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: "var(--green)" }}>
              SolSabotage
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Fix code. Find the traitor. Win SOL.
            </p>
          </div>
          <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
            A blocky world where the background stays fixed and the rooms are built from wood panels.
          </p>
        </div>

        <div className="wood-panel flex w-full max-w-lg flex-col items-center gap-4 p-5">
          <input
            type="text"
            placeholder="your wallet address"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="wood-input w-full px-3 py-2 text-sm outline-none"
            style={{ color: "var(--text)" }}
          />

          <button
            onClick={handleCreate}
            disabled={loadingAction !== null}
            className="hover-lift wood-button w-full py-3 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
            style={{ color: "var(--green)" }}
          >
            {loadingAction === "create" ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                creating...
              </span>
            ) : (
              "Create Game"
            )}
          </button>

          <div className="wood-panel-soft flex w-full flex-col gap-2 p-4">
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              or join a game
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ROOM ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="wood-input flex-1 px-3 py-2 text-sm outline-none uppercase tracking-widest"
                style={{ color: "var(--text)" }}
              />
              <button
                onClick={handleJoin}
                disabled={loadingAction !== null}
                className="hover-lift wood-button px-4 py-2 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
                style={{ color: "#f4f1ea" }}
              >
                {loadingAction === "join" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    joining...
                  </span>
                ) : (
                  "Join"
                )}
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
      </div>
    </main>
  );
}
