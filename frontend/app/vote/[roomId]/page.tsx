"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import RoomHeader from "@/components/RoomHeader";

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
}

function getInitialVoteState() {
  return {
    roomState: socket.getCurrentRoomState(),
    players: (socket.getLastMessage("GameJoined")?.players as Player[] | undefined) ?? [],
    voteCounts:
      (socket.getLastMessage("VoteUpdate")?.votes as Record<string, number> | undefined) ?? {},
  };
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const initialState = getInitialVoteState();
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [votedWallet, setVotedWallet] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(initialState.voteCounts);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialState.roomState === "lobby") {
      router.replace(`/lobby/${roomId}`);
      return;
    }

    if (initialState.roomState === "playing" || initialState.roomState === "code_locked") {
      router.replace(`/game/${roomId}`);
      return;
    }

    if (initialState.roomState === "meeting") {
      router.replace(`/meeting/${roomId}`);
      return;
    }

    if (initialState.roomState === "ended") {
      router.replace(`/results/${roomId}`);
      return;
    }

    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        setPlayers(msg.players as Player[]);
      }

      if (msg.type === "PlayerJoined" || msg.type === "PlayerLeft") {
        setPlayers(msg.players as Player[]);
      }

      if (msg.type === "VoteUpdate") {
        setVoteCounts(msg.votes as Record<string, number>);
      }

      if (msg.type === "GameOver") {
        router.push(`/results/${roomId}`);
      }

      if (msg.type === "Error") {
        setVotedWallet(null);
        setError(msg.message as string);
      }
    });

    return unsub;
  }, [initialState.roomState, roomId, router]);

  function handleVote(player: Player) {
    if (votedWallet) return;
    setVotedWallet(player.wallet);
    socket.send({ type: "CastVote", target_wallet: player.wallet });
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col gap-6">
        <RoomHeader
          badge="vote"
          title="Emergency Vote"
          description="you can vote anyone. one vote per wallet."
          roomId={roomId}
          accent="#ff4444"
        />

        <div className="space-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="space-title text-xs font-bold" style={{ color: "#ff6666" }}>
                voting board
              </span>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Pick any crewmate. The room tracks the tally live.
              </p>
            </div>
            <div className="wood-chip px-3 py-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#ff6666" }}>
              {votedWallet ? "vote locked" : "vote open"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => {
              const selected = votedWallet === player.wallet;

              return (
                <button
                  key={player.wallet}
                  onClick={() => handleVote(player)}
                  disabled={votedWallet !== null}
                  className="hover-lift wood-button flex flex-col gap-4 p-5 text-left disabled:opacity-70"
                  style={{
                    color: selected ? "#ff6666" : "var(--text)",
                    outline: selected ? "2px solid rgba(255, 102, 102, 0.55)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="crewmate-pill h-12 w-12" style={{ backgroundColor: player.color }} />
                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-bold capitalize">{player.color}</span>
                        <span className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--muted)" }}>
                          crewmate
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                      {voteCounts[player.wallet] ?? 0} votes
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {formatWallet(player.wallet)}
                    </span>
                    <span
                      className="wood-chip px-3 py-2 text-xs font-bold uppercase tracking-widest"
                      style={{ color: selected ? "#ff6666" : "var(--green)" }}
                    >
                      {selected ? "voted" : votedWallet ? "locked" : "vote"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="wood-panel-soft px-4 py-3 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
