"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface GameOverMsg {
  winner: string;
  impostor_color: string;
  impostor_wallet: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<GameOverMsg | null>(null);

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2">
        <p
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: result?.winner === "civilians" ? "var(--green)" : "#ff4444" }}
        >
          {result?.winner === "civilians" ? "impostor found" : "impostor wins"}
        </p>
        <h2 className="text-3xl font-bold">
          {result?.winner === "civilians" ? "Civilians Win" : "Impostor Wins"}
        </h2>
        {result && (
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: result.impostor_color }}
            />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {result.impostor_wallet} was the impostor
            </p>
          </div>
        )}
      </div>

      {!result && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          waiting for result...
        </p>
      )}

      <div
        className="w-96 px-4 py-3 border text-sm"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        NFT badge minting... bug squasher
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => router.push("/")}
          className="px-8 py-3 border text-sm font-bold tracking-widest uppercase"
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          Play Again
        </button>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-3 border text-sm font-bold tracking-widest uppercase"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Leave
        </button>
      </div>
    </main>
  );
}