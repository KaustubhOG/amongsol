"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import RoomHeader from "@/components/RoomHeader";
import Crewmate2D from "@/components/Crewmate2D";
import { crewColor } from "@/lib/colors";

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
}

function getInitialVoteState() {
  return {
    roomState: socket.getCurrentRoomState(),
    players: (socket.getLastMessage("GameJoined")?.players as Player[] | undefined) ?? [],
    voteCounts: (socket.getLastMessage("VoteUpdate")?.votes as Record<string, number> | undefined) ?? {},
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
    sound.play("vote");
    socket.send({ type: "CastVote", target_wallet: player.wallet });
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col gap-6">
        <RoomHeader
          badge="emergency vote"
          title="Eject the Impostor"
          description="you can vote anyone. one vote per wallet."
          roomId={roomId}
          accent="var(--danger)"
          action={
            <div className="chip" style={{ color: "var(--danger)" }}>
              {votedWallet ? "vote locked" : "vote open"}
            </div>
          }
        />

        <div className="panel rise-in p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => {
              const selected = votedWallet === player.wallet;
              const crew = crewColor(player.color);
              return (
                <button
                  key={player.wallet}
                  onClick={() => handleVote(player)}
                  onMouseEnter={() => sound.play("hover")}
                  disabled={votedWallet !== null}
                  className="panel-soft hover-lift pop-in flex flex-col gap-4 p-5 text-left disabled:opacity-80"
                  style={{ outline: selected ? `2px solid ${crew.base}` : "none" }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Crewmate2D color={player.color} size={48} className={selected ? "float-soft" : undefined} />
                      <div className="flex flex-col gap-1">
                        <span className="title text-xl" style={{ color: crew.base }}>{crew.label}</span>
                        <span className="text-[10px] uppercase" style={{ color: "var(--muted)", letterSpacing: "0.3em" }}>
                          crewmate
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase" style={{ color: "var(--muted)" }}>
                      {voteCounts[player.wallet] ?? 0} votes
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-sm" style={{ color: "var(--muted)" }}>{formatWallet(player.wallet)}</span>
                    <span className="chip text-xs uppercase" style={{ color: selected ? crew.base : "var(--accent)" }}>
                      {selected ? "voted" : votedWallet ? "locked" : "vote"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="panel-soft px-4 py-3 text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
