"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import { settleStake } from "@/lib/solana";

interface GameOverState {
  winner: string;
  impostor_color: string;
  impostor_wallet: string;
  payout?: {
    total_pot_lamports: number;
    recipients: { wallet: string; lamports: number }[];
  };
}

function getInitialResult() {
  return (socket.getLastMessage("GameOver") as GameOverState | null) ?? null;
}

function getInitialHostState() {
  const joined = socket.getLastMessage("GameJoined");
  const myColor = (joined?.your_color as string | undefined) ?? "";
  const players = (joined?.players as { color: string; is_host: boolean }[] | undefined) ?? [];
  const stakeProgram = (joined?.stake_program as string | undefined) ?? "";
  const isHost = players.find((player) => player.color === myColor)?.is_host ?? false;

  return { isHost, stakeProgram };
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function lamportsToSol(lamports: number) {
  return lamports / 1_000_000_000;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const initialHostState = getInitialHostState();
  const [result, setResult] = useState<GameOverState | null>(getInitialResult());
  const [isHost, setIsHost] = useState(initialHostState.isHost);
  const [stakeProgram, setStakeProgram] = useState(initialHostState.stakeProgram);
  const [settling, setSettling] = useState(false);
  const [settledSignature, setSettledSignature] = useState("");
  const [settleError, setSettleError] = useState("");

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        const color = msg.your_color as string;
        const playerList = msg.players as { color: string; is_host: boolean }[];
        setIsHost(playerList.find((player) => player.color === color)?.is_host ?? false);
        setStakeProgram((msg.stake_program as string | undefined) ?? "");
      }

      if (msg.type === "GameOver") {
        setResult({
          winner: msg.winner as string,
          impostor_color: msg.impostor_color as string,
          impostor_wallet: msg.impostor_wallet as string,
          payout: msg.payout as GameOverState["payout"],
        });
      }
    });
    return unsub;
  }, []);

  function handleExit() {
    socket.disconnect();
    router.push("/");
  }

  async function handleSettle() {
    if (settling || !result?.payout?.recipients.length) return;
    setSettleError("");
    setSettling(true);

    try {
      const signature = await settleStake(roomId, result.payout.recipients, stakeProgram);
      setSettledSignature(signature);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "failed to settle payout");
    } finally {
      setSettling(false);
    }
  }

  const civiliansWon = result?.winner === "civilians";
  const canSettle = isHost && Boolean(result?.payout?.recipients.length) && !settledSignature;

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
                  ? "The impostor stake is split across the remaining engineers."
                  : "The impostor receives the full room stake."}
              </p>
            </div>
            <div className="wood-panel-soft px-4 py-4 text-left">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                room
              </p>
              <p className="mt-2 text-lg font-bold tracking-widest">{roomId}</p>
            </div>
          </div>

          <div className="mb-6 wood-panel-soft px-4 py-4 text-left">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              payout
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              pot {lamportsToSol(result?.payout?.total_pot_lamports ?? 0)} SOL
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {(result?.payout?.recipients ?? []).map((recipient) => (
                <div key={recipient.wallet} className="flex items-center justify-between text-sm">
                  <span>{formatWallet(recipient.wallet)}</span>
                  <span style={{ color: "var(--green)" }}>{lamportsToSol(recipient.lamports)} SOL</span>
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <div className="mb-6 flex flex-col gap-2">
              <button
                onClick={handleSettle}
                disabled={!canSettle || settling}
                className="hover-lift wood-button w-full px-8 py-4 text-sm font-bold tracking-[0.25em] uppercase disabled:opacity-50"
                style={{ color: settledSignature ? "var(--green)" : "#ffcc66" }}
              >
                {settling ? "settling..." : settledSignature ? "payout settled" : "settle payout"}
              </button>
              {settledSignature ? (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {formatWallet(settledSignature)}
                </p>
              ) : null}
              {settleError ? (
                <p className="text-xs" style={{ color: "#ff6666" }}>
                  {settleError}
                </p>
              ) : null}
            </div>
          ) : null}

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
