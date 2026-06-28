"use client";

import { useMemo } from "react";

// Deterministic pseudo random from a seed. Pure (sine based), so it is safe to
// call during render and produces a stable confetti layout.
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Lightweight CSS confetti burst used on the win screen. Pure markup, no canvas.
export default function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(() => {
    const colors = ["#4cc9ff", "#2ee6a6", "#ffce4d", "#ff4d6d", "#b98bff", "#ffffff"];
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      left: seeded(i + 1) * 100,
      delay: seeded(i + 13) * 2.2,
      duration: 2.6 + seeded(i + 29) * 2.4,
      color: colors[i % colors.length],
      rotate: seeded(i + 47) * 360,
    }));
  }, [count]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 2 }}>
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
