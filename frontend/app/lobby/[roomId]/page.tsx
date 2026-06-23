"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
}

function getInitialLobbyState() {
  const joined = socket.getLastMessage("GameJoined");
  const myColor = (joined?.your_color as string | undefined) ?? "";
  const players = (joined?.players as Player[] | undefined) ?? [];
  const isHost = players.find((player) => player.color === myColor)?.is_host ?? false;
  const state = (joined?.state as string | undefined) ?? "lobby";

  return { myColor, players, isHost, state };
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialState.state === "playing" || initialState.state === "code_locked") {
      router.replace(`/game/${roomId}`);
      return;
    }

    if (initialState.state === "meeting") {
      router.replace(`/meeting/${roomId}`);
      return;
    }

    if (initialState.state === "voting") {
      router.replace(`/vote/${roomId}`);
      return;
    }

    if (initialState.state === "ended") {
      router.replace(`/results/${roomId}`);
      return;
    }

    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        const color = msg.your_color as string;
        const playerList = msg.players as Player[];
        setMyColor(color);
        setPlayers(playerList);
        setIsHost(playerList.find((player) => player.color === color)?.is_host ?? false);
      }

      if (msg.type === "PlayerJoined" || msg.type === "PlayerLeft") {
        setPlayers(msg.players as Player[]);
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
        setError(msg.message as string);
      }
    });

    return unsub;
  }, [initialState.state, roomId, router]);

  function handleStart() {
    socket.send({ type: "StartGame" });
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-6 border-b pb-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--green)" }}>
              SolSabotage
            </span>
            <h1 className="text-3xl font-bold">Waiting Room</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              room {roomId} · bring in enough engineers before the round starts
            </p>
          </div>

          <div className="min-w-56 border px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--muted)" }}>players</span>
              <span>{players.length}/4</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span style={{ color: "var(--muted)" }}>host</span>
              <span>{isHost ? "you" : "assigned"}</span>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="flex flex-col gap-3">
            {players.length === 0 && (
              <div className="border px-4 py-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                waiting for server
              </div>
            )}

            {players.map((player) => (
              <div
                key={player.wallet}
                className="grid items-center gap-4 border px-4 py-4 sm:grid-cols-[auto_1fr_auto]"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="text-sm font-bold">{player.color}</span>
                </div>
                <div className="text-sm" style={{ color: player.color === myColor ? "var(--text)" : "var(--muted)" }}>
                  {player.color === myColor ? "you" : formatWallet(player.wallet)}
                </div>
                <div className="text-xs font-bold tracking-widest uppercase" style={{ color: player.is_host ? "var(--green)" : "var(--muted)" }}>
                  {player.is_host ? "host" : "ready"}
                </div>
              </div>
            ))}
          </section>

          <aside className="flex flex-col gap-4 border p-5" style={{ borderColor: "var(--border)" }}>
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
                <span>2</span>
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
              <div className="border px-3 py-2 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
                {error}
              </div>
            )}

            {isHost ? (
              <button
                onClick={handleStart}
                disabled={players.length < 2}
                className="mt-auto w-full border py-3 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
                style={{ borderColor: "var(--green)", color: "var(--green)" }}
              >
                Start Round
              </button>
            ) : (
              <div className="mt-auto border px-3 py-2 text-xs font-bold tracking-widest uppercase" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                waiting for host
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
