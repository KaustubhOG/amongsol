"use client";

import { useRouter } from "next/navigation";
import HeroScene from "@/components/three/HeroScene";
import LivePlayers from "@/components/LivePlayers";
import sound from "@/lib/sound";

const features = [
  { label: "On-chain stakes", color: "var(--accent)" },
  { label: "2 to 4 crew", color: "var(--success)" },
  { label: "3 minute rounds", color: "var(--warn)" },
  { label: "Winner takes the pot", color: "var(--impostor)" },
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
      <div className="page-frame flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-6 py-4">
        <div className="rise-in flex flex-col items-center text-center">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            on-chain social deduction
          </span>
          <h1 className="title mt-3 text-6xl sm:text-8xl">
            <span className="shimmer">AmongSol</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--muted)" }}>
            Board the ship, repair the smart contract, and expose the impostor sabotaging the
            codebase before the timer runs out. Stakes lock on-chain and pay out to the winners.
          </p>
          <div className="mt-5">
            <LivePlayers />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {features.map((feature) => (
            <span key={feature.label} className="feature-chip">
              <span className="dot" style={{ background: feature.color }} />
              {feature.label}
            </span>
          ))}
        </div>

        <div className="relative w-full max-w-5xl">
          <HeroScene className="h-[340px] w-full sm:h-[440px]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="hint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11.5V6a2 2 0 0 1 4 0v5" />
                <path d="M13 9a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7 7 7 0 0 1-6-3.5L2 14a1.8 1.8 0 0 1 3-2l1 1V7a2 2 0 0 1 4 0" />
              </svg>
              tap a crewmate to poke them
            </span>
          </div>
        </div>

        <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
          <button
            onClick={() => go("/create")}
            onMouseEnter={() => sound.play("hover")}
            className="panel hover-lift pop-in flex min-h-52 flex-col justify-between p-7 text-left"
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
            className="panel hover-lift pop-in flex min-h-52 flex-col justify-between p-7 text-left"
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

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--faint)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="dot" style={{ width: "0.4rem", height: "0.4rem", borderRadius: "999px", background: "var(--accent)" }} />
            Solana Devnet
          </span>
          <span aria-hidden className="inline-block h-1 w-1 rounded-full" style={{ background: "var(--faint)" }} />
          <span>Stakes settle on-chain</span>
          <span aria-hidden className="inline-block h-1 w-1 rounded-full" style={{ background: "var(--faint)" }} />
          <span>2-4 players per room</span>
        </div>
      </div>
    </main>
  );
}
