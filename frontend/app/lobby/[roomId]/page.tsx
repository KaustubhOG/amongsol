"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";

interface Player {
  color: string;
  is_host: boolean;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [players, setPlayers] = useState<Player[]>([]);
  const [myColor, setMyColor] = useState("");
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        const color = msg.your_color as string;
        const playerList = msg.players as Player[];
        setMyColor(color);
        setPlayers(playerList);
        const me = playerList.find((p) => p.color === color);
        if (me) setIsHost(me.is_host);
      }
      if (msg.type === "PlayerJoined") {
        setPlayers(msg.players as Player[]);
      }
      if (msg.type === "GameStarted") {
        router.push(`/game/${roomId}`);
      }
    });

    const already = socket.getLastMessage("GameJoined");
    if (already) {
      const color = already.your_color as string;
      const playerList = already.players as Player[];
      setMyColor(color);
      setPlayers(playerList);
      const me = playerList.find((p) => p.color === color);
      if (me) setIsHost(me.is_host);
    }

    return unsub;
  }, [roomId, router]);

  function handleStart() {
    socket.send({ type: "StartGame" });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-2xl font-bold" style={{ color: "var(--green)" }}>
          Waiting Room
        </h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          room code: <span style={{ color: "var(--text)" }}>{roomId}</span>
        </p>
      </div>

      <div className="w-96 flex flex-col gap-2">
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          players ({players.length} / 4)
        </p>
        {players.map((player, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3 border"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className="text-sm">
                {player.color === myColor ? "you" : player.color}
              </span>
            </div>
            {player.is_host && (
              <span className="text-xs" style={{ color: "var(--green)" }}>
                host
              </span>
            )}
          </div>
        ))}
      </div>

      {players.length === 0 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          waiting for server...
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          setting up environment...
        </p>
        <div
          className="w-96 h-1 border"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="h-full w-3/4"
            style={{ backgroundColor: "var(--green)" }}
          />
        </div>
      </div>

      {isHost && (
        <button
          onClick={handleStart}
          disabled={players.length < 2}
          className="w-96 py-3 border text-sm font-bold tracking-widest uppercase"
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          waiting for host to start...
        </p>
      )}
    </main>
  );
}
