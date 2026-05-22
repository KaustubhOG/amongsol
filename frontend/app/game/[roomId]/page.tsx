"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";

interface TestResult {
  name: string;
  passed: boolean;
}

interface FunctionInfo {
  name: string;
  code: string;
}

interface PlayerStatus {
  color: string;
  status: string;
  function: string;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [code, setCode] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [players, setPlayers] = useState<PlayerStatus[]>([]);
  const [timer, setTimer] = useState(180);
  const [locked, setLocked] = useState(false);
  const myColor = useRef(socket.getWallet());

  useEffect(() => {
    const unsub = socket.onMessage((msg) => {
      if (msg.type === "GameStarted") {
        const fns = msg.functions as FunctionInfo[];
        setFunctions(fns);
        const initial: Record<string, string> = {};
        fns.forEach((f) => { initial[f.name] = f.code; });
        setCode(initial);
      }

      if (msg.type === "TestResults") {
        setTestResults(msg.results as TestResult[]);
      }

      if (msg.type === "PlayerEditing") {
        const color = msg.cursor_color as string;
        const fn = msg.function_name as string;
        setPlayers((prev) => {
          const existing = prev.find((p) => p.color === color);
          if (existing) {
            return prev.map((p) =>
              p.color === color ? { ...p, status: "editing", function: fn } : p
            );
          }
          return [...prev, { color, status: "editing", function: fn }];
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

      if (msg.type === "GameOver") {
        router.push(`/results/${roomId}`);
      }
    });

    return unsub;
  }, [roomId, router]);

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

  return (
    <main className="min-h-screen flex flex-col">
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-sm font-bold" style={{ color: "var(--green)" }}>
          SolSabotage
        </span>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          room: {roomId}
        </span>
        <div className="flex items-center gap-4">
          <span
            className="text-sm font-bold"
            style={{ color: timer <= 30 ? "#ff4444" : "var(--text)" }}
          >
            {timeStr}
          </span>
          <button
            onClick={handleMeeting}
            disabled={locked}
            className="px-4 py-1 border text-xs font-bold tracking-widest uppercase"
            style={{ borderColor: "#ff4444", color: "#ff4444" }}
          >
            Meeting
          </button>
        </div>
      </div>

      {locked && (
        <div
          className="text-center py-2 text-xs font-bold tracking-widest uppercase"
          style={{ backgroundColor: "#ff444422", color: "#ff4444" }}
        >
          code locked — final results
        </div>
      )}

      <div className="flex flex-1">
        <div
          className="flex-1 flex flex-col gap-4 p-6 border-r overflow-y-auto"
          style={{ borderColor: "var(--border)" }}
        >
          {functions.map((fn) => (
            <div key={fn.name} className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {fn.name}()
              </p>
              <textarea
                value={code[fn.name] ?? ""}
                onChange={(e) => handleCodeChange(fn.name, e.target.value)}
                disabled={locked}
                className="w-full h-40 bg-transparent border p-3 text-sm outline-none resize-none"
                style={{
                  borderColor: "var(--border)",
                  color: locked ? "var(--muted)" : "var(--text)",
                }}
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <div className="w-72 flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <p
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--muted)" }}
            >
              Test Results
            </p>
            {testResults.length === 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                click run tests
              </p>
            )}
            {testResults.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-sm">
                <span style={{ color: t.passed ? "var(--green)" : "#ff4444" }}>
                  {t.passed ? "pass" : "fail"}
                </span>
                <span style={{ color: "var(--muted)" }}>{t.name}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--muted)" }}
            >
              Players
            </p>
            {players.map((p) => (
              <div key={p.color} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.color}</span>
                </div>
                <span style={{ color: p.status === "editing" ? "var(--green)" : "var(--muted)" }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleRunTests}
            disabled={locked}
            className="w-full py-2 border text-sm font-bold tracking-widest uppercase mt-auto"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            Run Tests
          </button>
        </div>
      </div>
    </main>
  );
}