"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import RoomHeader from "@/components/RoomHeader";
import Crewmate2D from "@/components/Crewmate2D";
import CrewStage from "@/components/three/CrewStage";
import { deriveStakeAccounts, lamportsToSol, sendStake } from "@/lib/solana";
import { crewColor } from "@/lib/colors";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

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
  const playerCountRef = useRef(initialState.players.length);

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
        const playerList = msg.players as Player[];
        if (msg.type === "PlayerJoined" && playerList.length > playerCountRef.current) {
          sound.play("join");
        }
        playerCountRef.current = playerList.length;
        setPlayers(playerList);
      }

      if (msg.type === "StakeUpdated") {
        setPlayers(msg.players as Player[]);
        setStakeLamports(msg.stake_lamports as number);
        setStakeVault(msg.stake_vault as string);
        setStakeProgram((msg.stake_program as string | undefined) ?? "");
        setStaking(false);
        sound.play("stake");
      }

      if (msg.type === "GameStarted") {
        sound.play("start");
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
        sound.play("error");
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
    sound.play("click");
    socket.send({ type: "StartGame" });
  }

  async function handleStake() {
    if (staking) return;
    setError("");
    setStaking(true);
    sound.unlock();
    sound.play("click");

    try {
      const signature = await sendStake(roomId, stakeLamports, isHost, stakeProgram);
      socket.send({ type: "ConfirmStake", signature });
    } catch (err) {
      setStaking(false);
      setError(err instanceof Error ? err.message : "failed to stake");
      sound.play("error");
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
  const canStart = players.length >= MIN_PLAYERS && allStaked;

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col gap-6">
        <RoomHeader
          badge="waiting room"
          title="Crew Assembly"
          description="bring in enough engineers before the round starts"
          roomId={roomId}
          accent="var(--accent)"
          action={
            <div className="panel-soft flex min-w-56 flex-col gap-2 px-5 py-4 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>crew</span>
                <span className="font-bold">{players.length}/{MAX_PLAYERS}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>host</span>
                <span>{isHost ? "you" : "assigned"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>stake</span>
                <span style={{ color: "var(--accent)" }}>{lamportsToSol(stakeLamports)} SOL</span>
              </div>
            </div>
          }
        />

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="panel rise-in flex flex-col overflow-hidden">
            <CrewStage
              crew={players.length ? players.map((p) => ({ color: p.color })) : [{ color: "blue" }]}
              className="h-64 w-full"
              spread={2.2}
            />
            <div className="flex flex-col gap-3 p-5">
              {players.length === 0 && (
                <div className="panel-soft px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
                  waiting for the server
                </div>
              )}

              {players.map((player) => {
                const crew = crewColor(player.color);
                return (
                  <div
                    key={player.wallet}
                    className="panel-soft pop-in grid items-center gap-4 px-4 py-3 sm:grid-cols-[auto_1fr_auto]"
                  >
                    <div className="flex items-center gap-3">
                      <Crewmate2D color={player.color} size={34} />
                      <span className="font-bold" style={{ color: crew.base }}>{crew.label}</span>
                    </div>
                    <div className="text-sm font-mono" style={{ color: player.color === myColor ? "var(--text)" : "var(--muted)" }}>
                      {player.color === myColor ? "you" : formatWallet(player.wallet)}
                    </div>
                    <div
                      className="chip text-xs uppercase"
                      style={{
                        color: player.stake_signature ? "var(--success)" : player.is_host ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {player.stake_signature ? "staked" : player.is_host ? "host" : "ready"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="panel rise-in flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2">
              <p className="eyebrow" style={{ color: "var(--muted)" }}>round flow</p>
              <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                Repair the contract, run tests, call a meeting when the code smells wrong, then vote out the saboteur.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>minimum crew</span>
                <span className="font-bold">{MIN_PLAYERS}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>vault</span>
                <span className="font-mono">{formatWallet(derivedVault)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>round time</span>
                <span>3 min</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>code lock</span>
                <span style={{ color: "var(--warn)" }}>30 sec left</span>
              </div>
            </div>

            {error && (
              <div className="panel-soft px-4 py-3 text-xs" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleStake}
              onMouseEnter={() => sound.play("hover")}
              disabled={staking || hasStaked || !stakeReady}
              className={`btn w-full py-3 ${hasStaked ? "btn-success" : "btn-primary"}`}
            >
              {staking ? (
                <span className="inline-flex items-center gap-2"><span className="spin" /> staking</span>
              ) : hasStaked ? (
                "Stake locked"
              ) : (
                `Stake ${lamportsToSol(stakeLamports)} SOL`
              )}
            </button>

            {isHost ? (
              <button
                onClick={handleStart}
                onMouseEnter={() => sound.play("hover")}
                disabled={!canStart || starting}
                className="btn btn-success mt-auto w-full py-3"
              >
                {starting ? (
                  <span className="inline-flex items-center gap-2"><span className="spin" /> starting</span>
                ) : (
                  "Start round"
                )}
              </button>
            ) : (
              <div className="panel-soft mt-auto px-4 py-3 text-center text-xs uppercase" style={{ color: "var(--muted)", letterSpacing: "0.16em" }}>
                waiting for host
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
