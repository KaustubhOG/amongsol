"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import socket from "@/lib/socket";

interface TestResult {
  name: string;
  passed: boolean;
}

interface FunctionInfo {
  name: string;
  code: string;
}

interface Player {
  color: string;
  wallet: string;
  is_host: boolean;
}

interface PlayerStatus {
  color: string;
  wallet: string;
  status: string;
  functionName: string;
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getInitialGameState() {
  const joined = socket.getLastMessage("GameJoined");
  const started = socket.getLastMessage("GameStarted");
  const functions = (started?.functions as FunctionInfo[] | undefined) ?? [];
  const code = functions.reduce<Record<string, string>>((acc, fn) => {
    acc[fn.name] = fn.code;
    return acc;
  }, {});

  return {
    roomState: (joined?.state as string | undefined) ?? "lobby",
    myColor: (joined?.your_color as string | undefined) ?? "",
    players: (joined?.players as Player[] | undefined) ?? [],
    role: (socket.getLastMessage("RoleAssigned")?.role as string | undefined) ?? "",
    functions,
    code,
    testResults:
      (socket.getLastMessage("TestResults")?.results as TestResult[] | undefined) ?? [],
    timer: (socket.getLastMessage("TimerTick")?.remaining as number | undefined) ?? 180,
    locked: Boolean(socket.getLastMessage("CodeLocked")),
  };
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const initialState = getInitialGameState();

  const [functions, setFunctions] = useState<FunctionInfo[]>(initialState.functions);
  const [code, setCode] = useState<Record<string, string>>(initialState.code);
  const [testResults, setTestResults] = useState<TestResult[]>(initialState.testResults);
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [timer, setTimer] = useState(initialState.timer);
  const [locked, setLocked] = useState(initialState.locked);
  const [myColor, setMyColor] = useState(initialState.myColor);
  const [role, setRole] = useState(initialState.role);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialState.roomState === "meeting") {
      router.replace(`/meeting/${roomId}`);
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

    const applyGameStarted = (msg: Record<string, unknown>) => {
      const nextFunctions = msg.functions as FunctionInfo[];
      setFunctions(nextFunctions);
      setCode(
        nextFunctions.reduce<Record<string, string>>((acc, fn) => {
          acc[fn.name] = fn.code;
          return acc;
        }, {})
      );
    };

    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameJoined") {
        setPlayers(msg.players as Player[]);
        setMyColor(msg.your_color as string);
      }

      if (msg.type === "PlayerJoined" || msg.type === "PlayerLeft") {
        setPlayers(msg.players as Player[]);
      }

      if (msg.type === "RoleAssigned") {
        setRole(msg.role as string);
      }

      if (msg.type === "GameStarted") {
        applyGameStarted(msg);
      }

      if (msg.type === "TestResults") {
        setTestResults(msg.results as TestResult[]);
      }

      if (msg.type === "PlayerEditing") {
        const color = msg.cursor_color as string;
        const functionName = msg.function_name as string;
        setPlayerStatuses((prev) => {
          const player = players.find((entry) => entry.color === color);
          return {
            ...prev,
            [color]: {
              color,
              wallet: player?.wallet ?? "",
              status: "editing",
              functionName,
            },
          };
        });
      }

      if (msg.type === "TimerTick") {
        setTimer(msg.remaining as number);
      }

      if (msg.type === "CodeLocked") {
        setLocked(true);
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
  }, [initialState.roomState, players, roomId, router]);

  const visiblePlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        status: playerStatuses[player.color]?.status ?? "watching",
        functionName: playerStatuses[player.color]?.functionName ?? "",
      })),
    [playerStatuses, players]
  );

  function handleCodeChange(fnName: string, newCode: string) {
    if (locked) return;
    setCode((prev) => ({ ...prev, [fnName]: newCode }));
    socket.send({ type: "EditCode", function_name: fnName, code: newCode });
  }

  function handleRunTests() {
    socket.send({ type: "RunTests" });
  }

  function handleMeeting() {
    socket.send({ type: "CallMeeting" });
  }

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const myPlayer = players.find((player) => player.color === myColor);

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-screen flex-col border-r" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--green)" }}>
                  SolSabotage
                </span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  room {roomId}
                </span>
              </div>
              <div className="border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>role </span>
                <span style={{ color: role === "impostor" ? "#ff4444" : "var(--green)" }}>
                  {role || "pending"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-bold" style={{ color: timer <= 30 ? "#ff4444" : "var(--text)" }}>
                {timeStr}
              </span>
              <button
                onClick={handleMeeting}
                disabled={locked}
                className="border px-4 py-2 text-xs font-bold tracking-widest uppercase disabled:opacity-50"
                style={{ borderColor: "#ff4444", color: "#ff4444" }}
              >
                Call Meeting
              </button>
            </div>
          </div>

          {locked && (
            <div className="border-b px-6 py-2 text-xs font-bold tracking-widest uppercase" style={{ borderColor: "var(--border)", backgroundColor: "#ff444422", color: "#ff4444" }}>
              code locked
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-5">
              {functions.map((fn) => (
                <div key={fn.name} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                      {fn.name}
                    </p>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {myPlayer ? formatWallet(myPlayer.wallet) : "connected"}
                    </span>
                  </div>
                  <textarea
                    value={code[fn.name] ?? ""}
                    onChange={(event) => handleCodeChange(fn.name, event.target.value)}
                    disabled={locked}
                    className="min-h-[320px] w-full resize-none border bg-transparent p-4 text-sm outline-none"
                    style={{
                      borderColor: "var(--border)",
                      color: locked ? "var(--muted)" : "var(--text)",
                    }}
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex min-h-screen flex-col gap-6 px-5 py-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Objective
            </p>
            <div className="border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              {role === "impostor"
                ? "Keep suspicion off yourself and leave the code in a failing state."
                : "Repair the code, verify it with tests, and identify the saboteur."}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Test Results
            </p>
            <div className="flex flex-col gap-2">
              {testResults.length === 0 && (
                <div className="border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  no run yet
                </div>
              )}
              {testResults.map((result) => (
                <div key={result.name} className="flex items-center justify-between border px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
                  <span>{result.name}</span>
                  <span style={{ color: result.passed ? "var(--green)" : "#ff4444" }}>
                    {result.passed ? "pass" : "fail"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Players
            </p>
            <div className="flex flex-col gap-2">
              {visiblePlayers.map((player) => (
                <div key={player.wallet} className="border px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />
                      <span className="font-bold">{player.color}</span>
                    </div>
                    <span style={{ color: player.status === "editing" ? "var(--green)" : "var(--muted)" }}>
                      {player.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {player.color === myColor ? "you" : formatWallet(player.wallet)}
                  </div>
                  {player.functionName && (
                    <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                      {player.functionName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="border px-4 py-3 text-xs" style={{ borderColor: "#ff4444", color: "#ff4444" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleRunTests}
            disabled={locked}
            className="mt-auto w-full border py-3 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            Run Tests
          </button>
        </aside>
      </div>
    </main>
  );
}
