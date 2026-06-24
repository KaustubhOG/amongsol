"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2 border-b pb-5" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#ff4444" }}>
            Vote
          </span>
          <h1 className="text-3xl font-bold">Who sabotaged the build?</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            each wallet gets one vote
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {players.map((player) => (
            <div
              key={player.wallet}
              className="grid items-center gap-4 border px-4 py-4 sm:grid-cols-[auto_1fr_auto_auto]"
              style={{
                borderColor: votedWallet === player.wallet ? "#ff4444" : "var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />
                <span className="font-bold">{player.color}</span>
              </div>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {formatWallet(player.wallet)}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {voteCounts[player.wallet] ?? 0} votes
              </span>
              <button
                onClick={() => handleVote(player)}
                disabled={votedWallet !== null}
                className="hover-lift border px-4 py-2 text-xs font-bold tracking-widest uppercase disabled:opacity-50"
                style={{
                  borderColor: votedWallet === player.wallet ? "#ff4444" : "var(--border)",
                  color: votedWallet === player.wallet ? "#ff4444" : "var(--text)",
                }}
              >
                {votedWallet === player.wallet ? "voted" : "vote"}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="border px-4 py-3 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
