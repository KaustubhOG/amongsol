"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface Player {
  color: string;
  is_host: boolean;
}

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [players, setPlayers] = useState<Player[]>([]);
  const [voted, setVoted] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined" || msg.type === "PlayerJoined") {
        setPlayers(msg.players as Player[]);
      }
      if (msg.type === "VoteUpdate") {
        setVoteCounts(msg.votes as Record<string, number>);
      }
      if (msg.type === "GameOver") {
        router.push(`/results/${roomId}`);
      }
    });
    return unsub;
  }, [roomId, router]);

  function handleVote(color: string) {
    if (voted) return;
    setVoted(color);
    socket.send({ type: "CastVote", target_id: color });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-2xl font-bold">Vote</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          who is the impostor · 15 seconds
        </p>
      </div>

      <div className="w-96 flex flex-col gap-3">
        {players.map((player) => (
          <div
            key={player.color}
            className="flex items-center justify-between px-4 py-4 border"
            style={{
              borderColor: voted === player.color ? "#ff4444" : "var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className="text-sm">{player.color}</span>
            </div>
            <div className="flex items-center gap-3">
              {voteCounts[player.color] && (
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {voteCounts[player.color]} votes
                </span>
              )}
              <button
                onClick={() => handleVote(player.color)}
                disabled={voted !== null}
                className="px-4 py-1 border text-xs font-bold tracking-widest uppercase"
                style={{
                  borderColor: voted === player.color ? "#ff4444" : "var(--border)",
                  color: voted === player.color ? "#ff4444" : "var(--muted)",
                }}
              >
                {voted === player.color ? "voted" : "vote"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}