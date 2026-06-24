"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import socket from "@/lib/socket";
import { getBackendHttpUrl } from "@/lib/backend";
import { connectSolanaWallet } from "@/lib/solana";

const maps = [
  {
    id: "rust",
    label: "Rust",
    detail: "Pure Rust challenges with fast cargo test verification.",
    accent: "var(--green)",
  },
  {
    id: "anchor",
    label: "Anchor",
    detail: "Solana-style program logic challenges with account-state checks.",
    accent: "#ff6666",
  },
];

export default function CreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState<string | null>(null);

  async function handleSelectMap(mapId: string) {
    setError(null);
    setLoadingMap(mapId);

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
        return;
      }

      const data = await res.json();
      await socket.joinGame(data.game_id, wallet);
      router.push(`/lobby/${data.game_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create room");
    } finally {
      setLoadingMap(null);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-2rem)] items-start justify-center pt-10 sm:pt-16">
        <section className="w-full max-w-2xl px-4">
          <div className="mb-8 text-center">
            <span className="space-title text-xs font-bold" style={{ color: "var(--green)" }}>
              create game
            </span>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Choose a map</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6" style={{ color: "var(--muted)" }}>
              The room starts after you choose the challenge environment.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {maps.map((map) => (
              <button
                key={map.id}
                type="button"
                onClick={() => handleSelectMap(map.id)}
                className="hover-lift space-panel min-h-56 px-6 py-6 text-left sm:px-7 sm:py-7"
                style={{ color: "var(--text)" }}
                disabled={loadingMap !== null}
              >
                <div className="flex h-full flex-col justify-between gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="space-title text-xs font-bold" style={{ color: map.accent }}>
                      available map
                    </span>
                    <span className="text-4xl font-bold tracking-tight">{map.label}</span>
                    <span className="max-w-md text-sm leading-6" style={{ color: "var(--muted)" }}>
                      {map.detail}
                    </span>
                  </div>

                  <span
                    className="wood-chip w-fit px-3 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: map.accent }}
                  >
                    {loadingMap === map.id ? "creating" : "select"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error ? (
            <p className="mt-4 text-center text-sm" style={{ color: "#ff6666" }}>
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
