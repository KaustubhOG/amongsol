"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import socket from "@/lib/socket";
import sound from "@/lib/sound";
import { getBackendHttpUrl } from "@/lib/backend";
import { connectSolanaWallet } from "@/lib/solana";

const maps = [
  {
    id: "rust",
    label: "Rust",
    detail: "Pure Rust challenges verified with fast cargo test runs.",
    accent: "var(--accent)",
    tag: "systems",
  },
  {
    id: "anchor",
    label: "Anchor",
    detail: "Solana program logic challenges with account state checks.",
    accent: "var(--impostor)",
    tag: "on-chain",
  },
];

export default function CreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState<string | null>(null);

  async function handleSelectMap(mapId: string) {
    setError(null);
    setLoadingMap(mapId);
    sound.unlock();
    sound.play("click");

    try {
      const wallet = await connectSolanaWallet();
      socket.setWallet(wallet);
      const res = await fetch(getBackendHttpUrl("/game/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, map: mapId }),
      });

      if (!res.ok) {
        const raw = await res.text();
        try {
          const payload = JSON.parse(raw) as { error?: string };
          setError(payload.error ?? "failed to create room");
        } catch {
          setError(raw || "failed to create room");
        }
        sound.play("error");
        return;
      }

      const data = await res.json();
      await socket.joinGame(data.game_id, wallet);
      sound.play("join");
      router.push(`/lobby/${data.game_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create room");
      sound.play("error");
    } finally {
      setLoadingMap(null);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <section className="w-full max-w-3xl px-2">
          <div className="rise-in mb-8 text-center">
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              create game
            </span>
            <h1 className="title mt-2 text-4xl sm:text-5xl">Choose a map</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6" style={{ color: "var(--muted)" }}>
              The room opens the moment you pick a challenge environment.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {maps.map((map) => (
              <button
                key={map.id}
                type="button"
                onClick={() => handleSelectMap(map.id)}
                onMouseEnter={() => sound.play("hover")}
                className="panel hover-lift pop-in flex min-h-56 flex-col justify-between p-7 text-left"
                disabled={loadingMap !== null}
              >
                <div className="flex flex-col gap-3">
                  <span className="chip w-fit" style={{ color: map.accent }}>
                    {map.tag}
                  </span>
                  <span className="title text-4xl">{map.label}</span>
                  <span className="max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
                    {map.detail}
                  </span>
                </div>
                <span className="btn w-fit" style={{ borderColor: map.accent, color: map.accent }}>
                  {loadingMap === map.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="spin" /> creating
                    </span>
                  ) : (
                    "Select map"
                  )}
                </span>
              </button>
            ))}
          </div>

          {error ? (
            <div className="panel-soft mt-5 px-4 py-3 text-center text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          ) : null}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                sound.play("back");
                router.push("/");
              }}
              className="btn btn-ghost"
            >
              Back to home
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
