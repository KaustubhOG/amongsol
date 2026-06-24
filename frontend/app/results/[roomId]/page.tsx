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
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <section className="space-panel w-full max-w-2xl p-6 text-center sm:p-10">
          <div className="mb-6 flex flex-col items-center gap-4">
            <span className="space-title text-xs font-bold" style={{ color: civiliansWon ? "var(--green)" : "#ff6666" }}>
              {civiliansWon ? "impostor found" : "impostor escaped"}
            </span>
            <div
              className="crewmate-pill flex h-20 w-20 items-center justify-center text-3xl font-bold"
              style={{ backgroundColor: civiliansWon ? "rgba(20, 241, 149, 0.25)" : "rgba(255, 102, 102, 0.25)" }}
            >
              {civiliansWon ? "✓" : "!"}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {civiliansWon ? "Engineers Won" : "Sabotage Won"}
            </h1>
            <p className="max-w-lg text-sm leading-6" style={{ color: "var(--muted)" }}>
              {result ? `${formatWallet(result.impostor_wallet)} was the impostor.` : "Waiting for the round result."}
            </p>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="wood-panel-soft px-4 py-4 text-left">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                result
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                {civiliansWon
                  ? "The code held and the room voted clean."
                  : "The sabotage path finished first, so the impostor takes it."}
              </p>
            </div>
            <div className="wood-panel-soft px-4 py-4 text-left">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                room
              </p>
              <p className="mt-2 text-lg font-bold tracking-widest">{roomId}</p>
            </div>
          </div>

          <button
            onClick={handleExit}
            className="hover-lift wood-button w-full px-8 py-4 text-sm font-bold tracking-[0.25em] uppercase"
            style={{ color: "var(--green)" }}
          >
            return home
          </button>
        </section>
      </div>
    </main>
  );
}
