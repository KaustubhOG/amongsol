"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
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
      sound.play("error");
      return;
    }

    setLoading(true);
    setError("");
    sound.unlock();
    sound.play("click");

    try {
      const wallet = await connectSolanaWallet();
      socket.setWallet(wallet);
      await socket.joinGame(code, wallet);
      sound.play("join");
      router.push(`/lobby/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to join room");
      sound.play("error");
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <section className="panel rise-in w-full max-w-xl p-7 sm:p-9">
          <div className="mb-6 flex flex-col gap-2">
            <span className="eyebrow" style={{ color: "var(--impostor)" }}>
              join game
            </span>
            <h1 className="title text-4xl sm:text-5xl">Enter room code</h1>
            <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
              Your wallet connects automatically. You only need the room code.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleJoin();
              }}
              placeholder="ROOM CODE"
              className="input text-center text-xl font-bold uppercase"
              style={{ letterSpacing: "0.35em" }}
              spellCheck={false}
              maxLength={12}
            />

            <button
              onClick={handleJoin}
              onMouseEnter={() => sound.play("hover")}
              disabled={loading}
              className="btn btn-danger w-full py-4 text-base"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="spin" /> joining
                </span>
              ) : (
                "Join room"
              )}
            </button>

            {error && (
              <div className="panel-soft px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                sound.play("back");
                router.push("/");
              }}
              className="btn btn-ghost w-full"
            >
              Back to home
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
