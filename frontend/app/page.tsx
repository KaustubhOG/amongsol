"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <section className="w-full max-w-4xl px-4 py-8 sm:px-6">
          <div className="mb-8 text-center">
            <span className="space-title text-xs font-bold" style={{ color: "var(--green)" }}>
              amongsol
            </span>
            <h1 className="mt-2 text-5xl font-bold tracking-tight sm:text-7xl">Code Room</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6" style={{ color: "var(--muted)" }}>
              Enter the ship, fix the contract, and decide whether the round ends in a clean win or a quiet sabotage.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <button
              onClick={() => router.push("/create")}
              className="hover-lift space-panel flex min-h-64 flex-col justify-between p-6 text-left"
              style={{ color: "var(--text)" }}
            >
              <div className="flex flex-col gap-3">
                <span className="space-title text-xs font-bold" style={{ color: "var(--green)" }}>
                  create game
                </span>
                <span className="text-3xl font-bold tracking-tight">Build a room</span>
                <span className="max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
                  Pick the map, create the room, and bring the crew aboard.
                </span>
              </div>
              <div className="wood-chip inline-flex w-fit px-3 py-2 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--green)" }}>
                create new lobby
              </div>
            </button>

            <button
              onClick={() => router.push("/join")}
              className="hover-lift space-panel flex min-h-64 flex-col justify-between p-6 text-left"
              style={{ color: "var(--text)" }}
            >
              <div className="flex flex-col gap-3">
                <span className="space-title text-xs font-bold" style={{ color: "#ff6666" }}>
                  join game
                </span>
                <span className="text-3xl font-bold tracking-tight">Enter by code</span>
                <span className="max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
                  Drop in with the room code and the game takes over from there.
                </span>
              </div>
              <div className="wood-chip inline-flex w-fit px-3 py-2 text-xs font-bold tracking-widest uppercase" style={{ color: "#ff6666" }}>
                join existing room
              </div>
            </button>
          </div>

          <div className="mt-6 wood-panel-soft px-4 py-3 text-center text-xs leading-6" style={{ color: "var(--muted)" }}>
            <span className="font-bold" style={{ color: "#ffcc66" }}>Heads up:</span> each player needs a different wallet, and Phantom shares one
            active account across all tabs in the same browser. To play with friends on one machine, have each player join from a
            <span className="font-bold" style={{ color: "var(--text)" }}> separate browser</span> (or a separate browser profile) so everyone connects as a distinct player.
          </div>
        </section>
      </div>
    </main>
  );
}
