"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import RoomHeader from "@/components/RoomHeader";

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
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-8">
        <RoomHeader
          badge={civiliansWon ? "impostor found" : "impostor escaped"}
          title={civiliansWon ? "Engineers Held the Line" : "Sabotage Succeeded"}
          description={result ? `${formatWallet(result.impostor_wallet)} was the impostor` : "round finished"}
          roomId={roomId}
          accent={civiliansWon ? "var(--green)" : "#ff4444"}
        />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="wood-panel p-5">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Result
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              {civiliansWon
                ? "The final code state passed inspection and the team removed the saboteur."
                : "The final code state or the vote favored the impostor."}
            </p>
          </div>

          <div className="wood-panel p-5">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Room
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              {roomId}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="wood-panel-soft px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
            {!result
              ? "waiting for result"
              : civiliansWon
                ? "The final code state passed inspection and the team removed the saboteur."
                : "The final code state or the vote favored the impostor."}
          </div>

          <div className="wood-panel flex flex-col gap-4 p-5">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Next
            </p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Reset the room, invite the next players, and start another round.
            </p>
            <button
              onClick={handleExit}
              className="hover-lift wood-button mt-auto px-8 py-3 text-sm font-bold tracking-widest uppercase"
              style={{ color: "var(--green)" }}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
