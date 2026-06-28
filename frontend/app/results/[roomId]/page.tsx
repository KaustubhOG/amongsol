"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import Confetti from "@/components/Confetti";
import CrewStage from "@/components/three/CrewStage";
import { crewColor } from "@/lib/colors";
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
  const playedRef = useRef(false);

  const playOutcome = (winner: string | undefined) => {
    if (playedRef.current || !winner) return;
    playedRef.current = true;
    sound.play(winner === "civilians" ? "win" : "lose");
  };

  useEffect(() => {
    playOutcome(result?.winner);

    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        const color = msg.your_color as string;
        const playerList = msg.players as { color: string; is_host: boolean }[];
        setIsHost(playerList.find((player) => player.color === color)?.is_host ?? false);
        setStakeProgram((msg.stake_program as string | undefined) ?? "");
      }

      if (msg.type === "GameOver") {
        const winner = msg.winner as string;
        setResult({
          winner,
          impostor_color: msg.impostor_color as string,
          impostor_wallet: msg.impostor_wallet as string,
          payout: msg.payout as GameOverState["payout"],
        });
        playOutcome(winner);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExit() {
    sound.play("back");
    socket.disconnect();
    router.push("/");
  }

  async function handleSettle() {
    if (settling || !result?.payout?.recipients.length) return;
    setSettleError("");
    setSettling(true);
    sound.unlock();
    sound.play("click");

    try {
      const signature = await settleStake(roomId, result.payout.recipients, stakeProgram);
      setSettledSignature(signature);
      sound.play("success");
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "failed to settle payout");
      sound.play("error");
    } finally {
      setSettling(false);
    }
  }

  const civiliansWon = result?.winner === "civilians";
  const canSettle = isHost && Boolean(result?.payout?.recipients.length) && !settledSignature;
  const impostor = crewColor(result?.impostor_color);

  return (
    <main className="page-shell">
      <div className="page-frame relative flex min-h-[calc(100vh-3rem)] items-center justify-center">
        {civiliansWon && <Confetti />}
        <section className="panel pop-in relative z-[3] w-full max-w-2xl overflow-hidden p-7 text-center sm:p-10">
          <span className="eyebrow" style={{ color: civiliansWon ? "var(--success)" : "var(--impostor)" }}>
            {civiliansWon ? "impostor ejected" : "impostor escaped"}
          </span>

          <h1 className="title mt-3 text-5xl sm:text-6xl">
            <span className="shimmer">{civiliansWon ? "Engineers Win" : "Sabotage Wins"}</span>
          </h1>

          <CrewStage
            crew={[{ color: result?.impostor_color ?? "red", spin: true }]}
            className="mx-auto h-56 w-full max-w-md"
            cameraZ={5.5}
          />

          <p className="-mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
            {result ? (
              <>
                <span className="font-bold" style={{ color: impostor.base }}>{impostor.label}</span>
                {" "}({formatWallet(result.impostor_wallet)}) was the impostor.
              </>
            ) : (
              "Waiting for the round result."
            )}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="panel-soft px-4 py-4 text-left">
              <p className="eyebrow" style={{ color: "var(--muted)" }}>result</p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                {civiliansWon
                  ? "The pot is split across the surviving engineers."
                  : "The impostor takes the full room stake."}
              </p>
            </div>
            <div className="panel-soft px-4 py-4 text-left">
              <p className="eyebrow" style={{ color: "var(--muted)" }}>room</p>
              <p className="mt-2 font-mono text-lg font-bold" style={{ letterSpacing: "0.12em" }}>{roomId}</p>
            </div>
          </div>

          <div className="mt-4 panel-soft px-4 py-4 text-left">
            <p className="eyebrow" style={{ color: "var(--muted)" }}>payout</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              pot <span style={{ color: "var(--accent)" }}>{lamportsToSol(result?.payout?.total_pot_lamports ?? 0)} SOL</span>
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {(result?.payout?.recipients ?? []).map((recipient) => (
                <div key={recipient.wallet} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{formatWallet(recipient.wallet)}</span>
                  <span style={{ color: "var(--success)" }}>{lamportsToSol(recipient.lamports)} SOL</span>
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleSettle}
                onMouseEnter={() => sound.play("hover")}
                disabled={!canSettle || settling}
                className={`btn w-full py-4 ${settledSignature ? "btn-success" : "btn-primary"}`}
              >
                {settling ? (
                  <span className="inline-flex items-center gap-2"><span className="spin" /> settling</span>
                ) : settledSignature ? (
                  "Payout settled"
                ) : (
                  "Settle payout"
                )}
              </button>
              {settledSignature ? (
                <p className="font-mono text-xs" style={{ color: "var(--muted)" }}>{formatWallet(settledSignature)}</p>
              ) : null}
              {settleError ? (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{settleError}</p>
              ) : null}
            </div>
          ) : null}

          <button onClick={handleExit} onMouseEnter={() => sound.play("hover")} className="btn btn-ghost mt-4 w-full py-4">
            Return home
          </button>
        </section>
      </div>
    </main>
  );
}
