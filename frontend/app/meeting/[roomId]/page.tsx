"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import RoomHeader from "@/components/RoomHeader";
import Crewmate2D from "@/components/Crewmate2D";
import { crewColor } from "@/lib/colors";

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
    editHistory: (socket.getLastMessage("MeetingCalled")?.edit_history as EditInfo[] | undefined) ?? [],
    callerColor: (socket.getLastMessage("MeetingCalled")?.caller_color as string | undefined) ?? "",
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

    sound.play("alert");

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
    sound.play("vote");
    socket.send({ type: "StartVoting" });
  }

  const caller = crewColor(callerColor);

  return (
    <main className="page-shell alarm-flash">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col gap-6">
        <RoomHeader
          badge="emergency meeting"
          title="Review the Round"
          description={callerColor ? `${caller.label} called the meeting` : "meeting active"}
          roomId={roomId}
          accent="var(--danger)"
          action={
            <button onClick={handleVote} onMouseEnter={() => sound.play("hover")} disabled={startingVote} className="btn btn-danger">
              {startingVote ? (
                <span className="inline-flex items-center gap-2"><span className="spin" /> starting</span>
              ) : (
                "Start vote"
              )}
            </button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr]">
          <section className="panel rise-in flex flex-col gap-3 p-6">
            <p className="eyebrow" style={{ color: "var(--muted)" }}>edit history</p>

            {editHistory.length === 0 && (
              <div className="panel-soft px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
                no test history recorded yet
              </div>
            )}

            {editHistory.map((entry, index) => {
              const crew = crewColor(entry.cursor_color);
              return (
                <div
                  key={`${entry.cursor_color}-${entry.timestamp}-${index}`}
                  className="panel-soft grid items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[auto_1fr_auto_auto]"
                >
                  <div className="flex items-center gap-2">
                    <Crewmate2D color={entry.cursor_color} size={24} />
                    <span className="font-bold" style={{ color: crew.base }}>{crew.label}</span>
                  </div>
                  <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{entry.function_name}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{formatTime(entry.timestamp)}</span>
                  <span style={{ color: entry.result === "pass" ? "var(--success)" : "var(--danger)" }}>{entry.result}</span>
                </div>
              );
            })}
          </section>

          <aside className="panel rise-in flex flex-col gap-4 p-6">
            <div className="panel-soft p-4">
              <p className="eyebrow" style={{ color: "var(--muted)" }}>crew</p>
              <div className="mt-3 flex flex-col gap-2">
                {players.map((player) => {
                  const crew = crewColor(player.color);
                  return (
                    <div key={player.wallet} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Crewmate2D color={player.color} size={26} />
                        <span style={{ color: crew.base }}>{crew.label}</span>
                      </div>
                      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{formatWallet(player.wallet)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-soft p-4 text-sm leading-6" style={{ color: "var(--muted)" }}>
              Compare who touched failing runs, who called the meeting, and who is defending a broken result.
            </div>

            {error && (
              <div className="panel-soft px-4 py-3 text-xs" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
