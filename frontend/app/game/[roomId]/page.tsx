"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import RoomHeader from "@/components/RoomHeader";
import Crewmate2D from "@/components/Crewmate2D";
import { crewColor } from "@/lib/colors";

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

interface CursorPosition {
  line: number;
  column: number;
  label: string;
}

function formatWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getCursorPosition(source: string, selectionStart: number): CursorPosition {
  const safeSelection = Math.max(0, Math.min(selectionStart, source.length));
  const prefix = source.slice(0, safeSelection);
  const lines = prefix.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  return { line, column, label: `${line}:${column}` };
}

function getLineNumbers(source: string) {
  return source.split("\n").map((_, index) => index + 1);
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
    roomState: socket.getCurrentRoomState(),
    myColor: (joined?.your_color as string | undefined) ?? "",
    players: (joined?.players as Player[] | undefined) ?? [],
    role: (socket.getLastMessage("RoleAssigned")?.role as string | undefined) ?? "",
    functions,
    code,
    testResults: (socket.getLastMessage("TestResults")?.results as TestResult[] | undefined) ?? [],
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
  const [pendingAction, setPendingAction] = useState<"tests" | "meeting" | null>(null);
  const [cursorByFunction, setCursorByFunction] = useState<Record<string, CursorPosition>>({});

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
        const results = msg.results as TestResult[];
        setTestResults(results);
        setPendingAction((current) => (current === "tests" ? null : current));
        if (results.length > 0) {
          sound.play(results.every((r) => r.passed) ? "success" : "error");
        }
      }

      if (msg.type === "PlayerEditing") {
        const color = msg.cursor_color as string;
        const functionName = msg.function_name as string;
        setPlayerStatuses((prev) => {
          const player = players.find((entry) => entry.color === color);
          return {
            ...prev,
            [color]: { color, wallet: player?.wallet ?? "", status: "editing", functionName },
          };
        });
      }

      if (msg.type === "TimerTick") {
        setTimer(msg.remaining as number);
      }

      if (msg.type === "CodeLocked") {
        setLocked(true);
        sound.play("alert");
      }

      if (msg.type === "MeetingCalled") {
        setPendingAction((current) => (current === "meeting" ? null : current));
        sound.play("alert");
        router.push(`/meeting/${roomId}`);
      }

      if (msg.type === "VotingStarted") {
        setPendingAction(null);
        router.push(`/vote/${roomId}`);
      }

      if (msg.type === "GameOver") {
        setPendingAction(null);
        router.push(`/results/${roomId}`);
      }

      if (msg.type === "Error") {
        setPendingAction(null);
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

  function handleCodeChange(fnName: string, newCode: string, selectionStart?: number) {
    if (locked) return;
    setCode((prev) => ({ ...prev, [fnName]: newCode }));
    if (typeof selectionStart === "number") {
      setCursorByFunction((prev) => ({ ...prev, [fnName]: getCursorPosition(newCode, selectionStart) }));
    }
    socket.send({ type: "EditCode", function_name: fnName, code: newCode });
  }

  function handleRunTests() {
    if (locked || pendingAction) return;
    setPendingAction("tests");
    sound.play("test");
    socket.send({ type: "RunTests" });
  }

  function handleMeeting() {
    if (locked || pendingAction) return;
    setPendingAction("meeting");
    sound.play("alert");
    socket.send({ type: "CallMeeting" });
  }

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const myPlayer = players.find((player) => player.color === myColor);
  const isImpostor = role === "impostor";
  const danger = timer <= 30;
  const allPassing = testResults.length > 0 && testResults.every((r) => r.passed);

  return (
    <main className="page-shell">
      <div className="page-frame grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel flex min-h-full flex-col overflow-hidden">
          <RoomHeader
            badge="code room"
            title="Repair Bay"
            description="fix the contract, run tests, call a meeting if the code smells wrong"
            roomId={roomId}
            accent={isImpostor ? "var(--impostor)" : "var(--accent)"}
            action={
              <div className="flex items-center gap-3">
                <div className="chip" style={{ color: isImpostor ? "var(--impostor)" : "var(--success)" }}>
                  role <span className="font-bold">{role || "pending"}</span>
                </div>
                <div
                  className="panel-soft px-4 py-2 font-mono text-lg font-bold"
                  style={{ color: danger ? "var(--danger)" : "var(--text)", minWidth: "76px", textAlign: "center" }}
                >
                  {timeStr}
                </div>
                <button
                  onClick={handleMeeting}
                  onMouseEnter={() => sound.play("hover")}
                  disabled={locked || pendingAction === "meeting"}
                  className="btn btn-danger"
                >
                  {pendingAction === "meeting" ? (
                    <span className="inline-flex items-center gap-2"><span className="spin" /> calling</span>
                  ) : (
                    "Emergency"
                  )}
                </button>
              </div>
            }
          />

          {locked && (
            <div
              className="alarm-flash mt-4 rounded-xl px-5 py-2 text-center text-xs font-bold uppercase"
              style={{ background: "rgba(255,77,109,0.14)", color: "var(--danger)", letterSpacing: "0.18em" }}
            >
              code locked
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="panel-soft px-4 py-3 text-xs">
                <div style={{ color: "var(--muted)" }}>phase</div>
                <div className="mt-1 font-bold uppercase" style={{ color: locked ? "var(--danger)" : "var(--success)", letterSpacing: "0.12em" }}>
                  {locked ? "locked" : pendingAction ? "working" : "editing"}
                </div>
              </div>
              <div className="panel-soft px-4 py-3 text-xs">
                <div style={{ color: "var(--muted)" }}>tests</div>
                <div className="mt-1 font-bold uppercase" style={{ color: allPassing ? "var(--success)" : "var(--warn)", letterSpacing: "0.12em" }}>
                  {testResults.length === 0 ? "no run" : allPassing ? "passing" : "failing"}
                </div>
              </div>
              <div className="panel-soft px-4 py-3 text-xs">
                <div style={{ color: "var(--muted)" }}>your role</div>
                <div className="mt-1 font-bold uppercase" style={{ color: isImpostor ? "var(--impostor)" : "var(--success)", letterSpacing: "0.12em" }}>
                  {role || "pending"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {functions.map((fn) => {
                const hasRemoteCursor = Object.values(playerStatuses).some((entry) => entry.functionName === fn.name);
                return (
                  <div key={fn.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-mono text-xs font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.12em" }}>
                        {fn.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                        <span className="font-mono">{myPlayer ? formatWallet(myPlayer.wallet) : "connected"}</span>
                        {cursorByFunction[fn.name] && (
                          <span className="chip font-mono text-[10px]" style={{ color: "var(--success)" }}>
                            {cursorByFunction[fn.name].label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="editor-shell"
                      style={{ borderColor: hasRemoteCursor ? "var(--accent)" : "var(--panel-line)" }}
                    >
                      <div className="grid grid-cols-[52px_minmax(0,1fr)]">
                        <div className="editor-gutter select-none px-3 py-4 text-right text-xs leading-6">
                          {getLineNumbers(code[fn.name] ?? "").slice(0, 120).map((lineNumber) => (
                            <div key={lineNumber}>{lineNumber}</div>
                          ))}
                        </div>
                        <div className="relative">
                          <textarea
                            value={code[fn.name] ?? ""}
                            onChange={(event) =>
                              handleCodeChange(fn.name, event.target.value, event.currentTarget.selectionStart ?? undefined)
                            }
                            onSelect={(event) =>
                              handleCodeChange(fn.name, event.currentTarget.value, event.currentTarget.selectionStart ?? undefined)
                            }
                            onKeyUp={(event) =>
                              handleCodeChange(fn.name, event.currentTarget.value, event.currentTarget.selectionStart ?? undefined)
                            }
                            disabled={locked}
                            className="code-area cursor-text min-h-[300px] w-full resize-none bg-transparent p-4 text-sm leading-6 outline-none"
                            style={{ color: locked ? "var(--muted)" : "var(--text)" }}
                            spellCheck={false}
                          />
                          <div className="pointer-events-none absolute right-3 top-3 flex flex-wrap justify-end gap-2">
                            {Object.values(playerStatuses)
                              .filter((entry) => entry.functionName === fn.name)
                              .map((entry) => (
                                <span
                                  key={`${entry.color}-${fn.name}`}
                                  className="chip text-[10px] uppercase"
                                  style={{ color: crewColor(entry.color).base, borderColor: crewColor(entry.color).base }}
                                >
                                  {crewColor(entry.color).label} cursor
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="panel flex min-h-full flex-col gap-6 overflow-hidden p-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow" style={{ color: "var(--muted)" }}>objective</p>
            <div className="panel-soft px-4 py-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
              {isImpostor
                ? "Keep suspicion off yourself and leave the code in a failing state."
                : "Repair the code, verify it with tests, and identify the saboteur."}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="eyebrow" style={{ color: "var(--muted)" }}>test results</p>
            <div className="flex flex-col gap-2">
              {testResults.length === 0 && (
                <div className="panel-soft px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                  no run yet
                </div>
              )}
              {testResults.map((result) => (
                <div key={result.name} className="panel-soft flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-mono text-xs">{result.name}</span>
                  <span style={{ color: result.passed ? "var(--success)" : "var(--danger)" }}>
                    {result.passed ? "pass" : "fail"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="eyebrow" style={{ color: "var(--muted)" }}>crew</p>
            <div className="flex flex-col gap-2">
              {visiblePlayers.map((player) => (
                <div key={player.wallet} className="panel-soft flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Crewmate2D color={player.color} size={28} />
                    <div className="flex flex-col">
                      <span className="font-bold" style={{ color: crewColor(player.color).base }}>
                        {crewColor(player.color).label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {player.color === myColor ? "you" : formatWallet(player.wallet)}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: player.status === "editing" ? "var(--success)" : "var(--muted)" }}>
                    {player.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="panel-soft px-4 py-3 text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleRunTests}
            onMouseEnter={() => sound.play("hover")}
            disabled={locked || pendingAction === "tests"}
            className="btn btn-primary mt-auto w-full py-3"
          >
            {pendingAction === "tests" ? (
              <span className="inline-flex items-center gap-2"><span className="spin" /> running</span>
            ) : (
              "Run tests"
            )}
          </button>
        </aside>
      </div>
    </main>
  );
}
