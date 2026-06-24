"use client";

import { useRouter } from "next/navigation";
import socket from "@/lib/socket";

const maps = [
  {
    id: "rust",
    label: "Rust",
    detail: "Only language available right now. Fast, strict, and easy to sabotage.",
    accent: "var(--green)",
  },
];

export default function CreatePage() {
  const router = useRouter();

  async function handleSelectMap(mapId: string) {
    if (mapId !== "rust") return;

    const wallet = socket.ensureWallet();

    try {
      const res = await fetch("http://localhost:8080/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });

      const data = await res.json();
      await socket.connectAndWait(wallet);
      socket.send({ type: "JoinGame", game_id: data.game_id, wallet });
      router.push(`/lobby/${data.game_id}`);
    } catch {
      router.push("/");
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
              The room starts after you choose the language. For now, Rust is the only available map.
            </p>
          </div>

          <div className="flex justify-center">
            {maps.map((map) => (
              <button
                key={map.id}
                onClick={() => handleSelectMap(map.id)}
                className="hover-lift space-panel w-full max-w-xl px-6 py-6 text-left sm:px-7 sm:py-7"
                style={{ color: "var(--text)" }}
              >
                <div className="flex items-start justify-between gap-6">
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
                    className="wood-chip shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: map.accent }}
                  >
                    select
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
