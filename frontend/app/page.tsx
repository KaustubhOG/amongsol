"use client";

import { useRouter } from "next/navigation";
import CrewStage from "@/components/three/CrewStage";
import sound from "@/lib/sound";

const heroCrew = [
  { color: "red" },
  { color: "blue" },
  { color: "green" },
  { color: "yellow" },
];

export default function Home() {
  const router = useRouter();

  function go(path: string) {
    sound.unlock();
    sound.play("click");
    router.push(path);
  }

  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-8 py-6">
        <div className="rise-in flex flex-col items-center text-center">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            on-chain social deduction
          </span>
          <h1 className="title mt-3 text-6xl sm:text-8xl">
            <span className="shimmer">AmongSol</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--muted)" }}>
            Board the ship, repair the smart contract, and expose the impostor sabotaging the
            codebase before the timer runs out. Stakes are locked on-chain and paid to the winners.
          </p>
        </div>

        <CrewStage crew={heroCrew} className="h-[300px] w-full max-w-4xl sm:h-[340px]" spread={2.6} />

        <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
          <button
            onClick={() => go("/create")}
            onMouseEnter={() => sound.play("hover")}
            className="panel hover-lift pop-in glow-pulse flex min-h-56 flex-col justify-between p-7 text-left"
          >
            <div className="flex flex-col gap-2">
              <span className="eyebrow" style={{ color: "var(--accent)" }}>
                create game
              </span>
              <span className="title text-3xl">Build a room</span>
              <span className="max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
                Pick the challenge map, open a lobby, and bring the crew aboard.
              </span>
            </div>
            <span className="btn btn-primary w-fit">Create new lobby</span>
          </button>

          <button
            onClick={() => go("/join")}
            onMouseEnter={() => sound.play("hover")}
            className="panel hover-lift pop-in flex min-h-56 flex-col justify-between p-7 text-left"
          >
            <div className="flex flex-col gap-2">
              <span className="eyebrow" style={{ color: "var(--impostor)" }}>
                join game
              </span>
              <span className="title text-3xl">Enter by code</span>
              <span className="max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
                Drop into a friend&apos;s room with the code and the game takes it from there.
              </span>
            </div>
            <span className="btn btn-danger w-fit">Join existing room</span>
          </button>
        </div>

        <div className="panel-soft max-w-4xl px-5 py-4 text-center text-xs leading-6" style={{ color: "var(--muted)" }}>
          <span className="font-bold" style={{ color: "var(--warn)" }}>Heads up:</span> each player needs a
          different wallet, and Phantom shares one active account across all tabs in the same browser. To play
          with friends on one machine, have each player join from a{" "}
          <span className="font-bold" style={{ color: "var(--text)" }}>separate browser</span> (or a separate
          browser profile) so everyone connects as a distinct crewmate.
        </div>
      </div>
    </main>
  );
}
