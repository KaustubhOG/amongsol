"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import RoomHeader from "@/components/RoomHeader";

interface EditInfo {
  cursor_color: string;
  function_name: string;
  timestamp: number;
  result: string;
}

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
}

function getInitialMeetingState() {
  return {
    roomState: socket.getCurrentRoomState(),
    editHistory:
      (socket.getLastMessage("MeetingCalled")?.edit_history as EditInfo[] | undefined) ?? [],
    callerColor:
      (socket.getLastMessage("MeetingCalled")?.caller_color as string | undefined) ?? "",
    players: (socket.getLastMessage("GameJoined")?.players as Player[] | undefined) ?? [],
  };
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getMinutes()}:${date.getSeconds().toString().padStart(2, "0")}`;
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const initialState = getInitialMeetingState();
  const [editHistory, setEditHistory] = useState<EditInfo[]>(initialState.editHistory);
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [callerColor, setCallerColor] = useState(initialState.callerColor);
  const [error, setError] = useState("");
  const [startingVote, setStartingVote] = useState(false);

  useEffect(() => {
    if (initialState.roomState === "lobby") {
      router.replace(`/lobby/${roomId}`);
      return;
    }

    if (initialState.roomState === "playing" || initialState.roomState === "code_locked") {
      router.replace(`/game/${roomId}`);
      return;
    }

    if (initialState.roomState === "voting") {
      router.replace(`/vote/${roomId}`);
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

      if (msg.type === "MeetingCalled") {
        setEditHistory(msg.edit_history as EditInfo[]);
        setCallerColor(msg.caller_color as string);
      }

      if (msg.type === "VotingStarted") {
        setStartingVote(false);
        router.push(`/vote/${roomId}`);
      }

      if (msg.type === "GameOver") {
        setStartingVote(false);
        router.push(`/results/${roomId}`);
      }

      if (msg.type === "Error") {
        setStartingVote(false);
        setError(msg.message as string);
      }
    });

    return unsub;
  }, [initialState.roomState, roomId, router]);

  function handleVote() {
    if (startingVote) return;
    setStartingVote(true);
    socket.send({ type: "StartVoting" });
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col gap-6">
        <RoomHeader
          badge="emergency meeting"
          title="Review the Round"
          description={callerColor ? `${callerColor} called the meeting` : "meeting active"}
          roomId={roomId}
          accent="#ff4444"
          action={
            <button
              onClick={handleVote}
              disabled={startingVote}
              className="hover-lift wood-button px-5 py-3 text-sm font-bold tracking-widest uppercase"
              style={{ color: "#ff4444" }}
            >
              {startingVote ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  starting...
                </span>
              ) : (
                "Start Vote"
              )}
            </button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="wood-panel flex flex-col gap-3 p-5">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Edit History
            </p>

            {editHistory.length === 0 && (
              <div className="wood-panel-soft px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
                no test history recorded yet
              </div>
            )}

            {editHistory.map((entry, index) => (
              <div
                key={`${entry.cursor_color}-${entry.timestamp}-${index}`}
                className="wood-panel-soft grid items-center gap-3 px-4 py-4 text-sm sm:grid-cols-[auto_1fr_auto_auto]"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.cursor_color }} />
                  <span className="font-bold">{entry.cursor_color}</span>
                </div>
                <span style={{ color: "var(--muted)" }}>{entry.function_name}</span>
                <span style={{ color: "var(--muted)" }}>{formatTime(entry.timestamp)}</span>
                <span style={{ color: entry.result === "pass" ? "var(--green)" : "#ff4444" }}>
                  {entry.result}
                </span>
              </div>
            ))}
          </section>

          <aside className="wood-panel flex flex-col gap-4 p-5">
            <div className="wood-panel-soft p-4">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                Players
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {players.map((player) => (
                  <div key={player.wallet} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />
                      <span>{player.color}</span>
                    </div>
                    <span style={{ color: "var(--muted)" }}>{formatWallet(player.wallet)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="wood-panel-soft p-4 text-sm" style={{ color: "var(--muted)" }}>
              Compare who touched failing runs, who called the meeting, and who is defending a broken result.
            </div>

            {error && (
              <div className="wood-panel-soft px-4 py-3 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
                {error}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
