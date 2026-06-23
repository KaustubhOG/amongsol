"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface GameOverState {
  winner: string;
  impostor_color: string;
  impostor_wallet: string;
}

function getInitialResult() {
  return (socket.getLastMessage("GameOver") as GameOverState | null) ?? null;
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [result, setResult] = useState<GameOverState | null>(getInitialResult());

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameOver") {
        setResult({
          winner: msg.winner as string,
          impostor_color: msg.impostor_color as string,
          impostor_wallet: msg.impostor_wallet as string,
        });
      }
    });
    return unsub;
  }, []);

  function handleExit() {
    socket.disconnect();
    router.push("/");
  }

  const civiliansWon = result?.winner === "civilians";

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-between gap-8">
        <div className="flex flex-col gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: civiliansWon ? "var(--green)" : "#ff4444" }}>
            {civiliansWon ? "impostor found" : "impostor escaped"}
          </span>
          <h1 className="text-4xl font-bold">
            {civiliansWon ? "Engineers held the line" : "Sabotage succeeded"}
          </h1>
          {result && (
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: result.impostor_color }} />
              <span>{formatWallet(result.impostor_wallet)} was the impostor</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Result
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              {civiliansWon
                ? "The final code state passed inspection and the team removed the saboteur."
                : "The final code state or the vote favored the impostor."}
            </p>
          </div>

          <div className="border p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Room
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              {roomId}
            </p>
          </div>
        </div>

        {!result && (
          <div className="border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            waiting for result
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleExit}
            className="border px-8 py-3 text-sm font-bold tracking-widest uppercase"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            Return Home
          </button>
        </div>
      </div>
    </main>
  );
}
