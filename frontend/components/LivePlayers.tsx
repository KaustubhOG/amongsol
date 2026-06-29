"use client";

import { useEffect, useState } from "react";

// Sine-hash pseudo random - stable for a given seed, good enough for a cosmetic
// "live" presence number that should feel organic without a backend.
function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// A per-hour base centered around ~20 (averaging three samples pulls the mass
// toward the middle), clamped to 8-40 so it sits mostly in the 15-25 band and
// only occasionally drifts to the extremes. Changes once an hour.
function hourlyBase(hourSeed: number) {
  const r = (hash(hourSeed) + hash(hourSeed + 99) + hash(hourSeed + 7)) / 3;
  const value = Math.round(20 + (r - 0.5) * 34);
  return Math.min(40, Math.max(8, value));
}

export default function LivePlayers() {
  // null on the server and the first client render (no hydration mismatch); the
  // number fades in once mounted.
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let current: number | null = null;

    const tick = () => {
      const base = hourlyBase(Math.floor(Date.now() / 3_600_000));
      if (current === null) {
        current = base;
      } else {
        const step = Math.random() < 0.5 ? -1 : 1;
        // Wander gently, but never stray far from the hour's base or out of range.
        current = Math.min(base + 2, Math.max(base - 2, current + step));
      }
      current = Math.min(40, Math.max(8, current));
      setCount(current);
    };

    // Scheduled (not synchronous in the effect body) so the first value still
    // lands right after mount without triggering a cascading render.
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 4500);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  return (
    <span className="feature-chip" aria-live="polite" style={{ borderColor: "var(--panel-line-strong)" }}>
      <span className="live-dot" aria-hidden />
      <span>
        <span
          className="font-bold tabular-nums"
          style={{ color: "var(--text)", display: "inline-block", minWidth: "1.4ch" }}
        >
          {count ?? ""}
        </span>{" "}
        crewmates playing live
      </span>
    </span>
  );
}
