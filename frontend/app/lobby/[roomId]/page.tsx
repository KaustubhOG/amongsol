"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import RoomHeader from "@/components/RoomHeader";
import { deriveStakeAccounts, lamportsToSol, sendStake } from "@/lib/solana";

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
  stake_lamports: number;
  stake_signature?: string | null;
}

interface LobbyState {
  myColor: string;
  players: Player[];
  isHost: boolean;
  state: string;
  stakeLamports: number;
  stakeVault: string;
  stakeProgram: string;
}

function getInitialLobbyState(): LobbyState {
  if (typeof window === "undefined") {
    return { myColor: "", players: [], isHost: false, state: "lobby", stakeLamports: 100_000_000, stakeVault: "", stakeProgram: "" };
  }
  const joined = socket.getLastMessage("GameJoined");
  const myColor = (joined?.your_color as string | undefined) ?? "";
  const players = (joined?.players as Player[] | undefined) ?? [];
  const isHost = players.find((player) => player.color === myColor)?.is_host ?? false;
  const state = (joined?.state as string | undefined) ?? "lobby";
  const stakeLamports = (joined?.stake_lamports as number | undefined) ?? 100_000_000;
  const stakeVault = (joined?.stake_vault as string | undefined) ?? "";
  const stakeProgram = (joined?.stake_program as string | undefined) ?? "";

  return { myColor, players, isHost, state, stakeLamports, stakeVault, stakeProgram };
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const initialState = getInitialLobbyState();
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [myColor, setMyColor] = useState(initialState.myColor);
  const [isHost, setIsHost] = useState(initialState.isHost);
  const [stakeLamports, setStakeLamports] = useState(initialState.stakeLamports);
  const [stakeVault, setStakeVault] = useState(initialState.stakeVault);
  const [stakeProgram, setStakeProgram] = useState(initialState.stakeProgram);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [staking, setStaking] = useState(false);

  useEffect(() => {
    let active = true;

    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        const color = msg.your_color as string;
        const playerList = msg.players as Player[];
        setMyColor(color);
        setPlayers(playerList);
        setIsHost(playerList.find((player) => player.color === color)?.is_host ?? false);
        setStakeLamports((msg.stake_lamports as number | undefined) ?? 100_000_000);
        setStakeVault((msg.stake_vault as string | undefined) ?? "");
        setStakeProgram((msg.stake_program as string | undefined) ?? "");
      }

      if (msg.type === "PlayerJoined" || msg.type === "PlayerLeft") {
        setPlayers(msg.players as Player[]);
      }

      if (msg.type === "StakeUpdated") {
        setPlayers(msg.players as Player[]);
        setStakeLamports(msg.stake_lamports as number);
        setStakeVault(msg.stake_vault as string);
        setStakeProgram((msg.stake_program as string | undefined) ?? "");
        setStaking(false);
      }

      if (msg.type === "GameStarted") {
        router.push(`/game/${roomId}`);
      }

      if (msg.type === "MeetingCalled") {
        router.push(`/meeting/${roomId}`);
      }

      if (msg.type === "VotingStarted") {
        router.push(`/vote/${roomId}`);
      }

      if (msg.type === "GameOver") {
        router.push(`/results/${roomId}`);
      }

      if (msg.type === "Error") {
        setStarting(false);
        setStaking(false);
        setError(msg.message as string);
      }
    });

    const wallet = socket.ensureWallet();
    socket.joinGame(roomId, wallet).catch((err) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "failed to join room");
    });

    return () => {
      active = false;
      unsub();
    };
  }, [roomId, router]);

  function handleStart() {
    if (starting) return;
    setStarting(true);
    socket.send({ type: "StartGame" });
  }

  async function handleStake() {
    if (staking) return;
    setError("");
    setStaking(true);

    try {
      const signature = await sendStake(roomId, stakeLamports, isHost, stakeProgram);
      socket.send({ type: "ConfirmStake", signature });
    } catch (err) {
      setStaking(false);
      setError(err instanceof Error ? err.message : "failed to stake");
    }
  }

  const myPlayer = players.find((player) => player.color === myColor);
  const hasStaked = Boolean(myPlayer?.stake_signature);
  const allStaked = players.length > 0 && players.every((player) => player.stake_signature);
  const derivedVault = (() => {
    try {
      return deriveStakeAccounts(roomId, stakeProgram).vault.toString();
    } catch {
      return stakeVault;
    }
  })();
  const stakeReady = Boolean(stakeProgram && !stakeProgram.startsWith("Set "));

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col justify-between gap-8">
        <RoomHeader
          badge="amongsol"
          title="Waiting Room"
          description="bring in enough engineers before the round starts"
          roomId={roomId}
          accent="var(--green)"
          action={
            <div className="wood-panel-soft min-w-56 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>players</span>
                <span>{players.length}/4</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>host</span>
                <span>{isHost ? "you" : "assigned"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>stake</span>
                <span>{lamportsToSol(stakeLamports)} SOL</span>
              </div>
            </div>
          }
        />

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="space-panel flex flex-col gap-3 p-4">
            {players.length === 0 && (
              <div className="wood-panel-soft px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
                waiting for server
              </div>
            )}

            {players.map((player) => (
              <div
                key={player.wallet}
                className="wood-panel-soft grid items-center gap-4 px-4 py-4 sm:grid-cols-[auto_1fr_auto]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="text-sm font-bold">{player.color}</span>
                </div>
                <div className="text-sm" style={{ color: player.color === myColor ? "var(--text)" : "var(--muted)" }}>
                  {player.color === myColor ? "you" : formatWallet(player.wallet)}
                </div>
                <div className="text-xs font-bold tracking-widest uppercase" style={{ color: player.is_host ? "var(--green)" : "var(--muted)" }}>
                  {player.stake_signature ? "staked" : player.is_host ? "host" : "ready"}
                </div>
              </div>
            ))}
          </section>

          <aside className="space-panel flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                Round Flow
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Edit the contract, run tests, call a meeting if the code smells wrong, then vote out the saboteur.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>minimum players</span>
                <span>4</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>vault</span>
                <span>{formatWallet(derivedVault)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>round time</span>
                <span>3 min</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>code lock</span>
                <span>30 sec left</span>
              </div>
            </div>

            {error && (
              <div className="wood-panel-soft px-3 py-2 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleStake}
              disabled={staking || hasStaked || !stakeReady}
              className="hover-lift wood-button w-full py-3 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
              style={{ color: hasStaked ? "var(--green)" : "#ffcc66" }}
            >
              {staking ? "staking..." : hasStaked ? "stake locked" : `stake ${lamportsToSol(stakeLamports)} SOL`}
            </button>

            {isHost ? (
              <button
                onClick={handleStart}
                disabled={players.length < 4 || !allStaked || starting}
                className="hover-lift wood-button mt-auto w-full py-3 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
                style={{ color: "var(--green)" }}
              >
                {starting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    starting...
                  </span>
                ) : (
                  "Start Round"
                )}
              </button>
            ) : (
              <div className="wood-panel-soft mt-auto px-3 py-2 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                waiting for host
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
