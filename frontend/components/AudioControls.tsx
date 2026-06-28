"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import sound from "@/lib/sound";

// Unlocks the audio engine on the first user gesture (autoplay policy) and
// renders a floating mute toggle. Mounted once in the root layout.
export default function AudioControls() {
  const subscribe = useCallback((cb: () => void) => sound.subscribe(cb), []);
  const muted = useSyncExternalStore(
    subscribe,
    () => sound.isMuted(),
    () => false
  );

  useEffect(() => {
    const unlock = () => sound.unlock();
    const opts = { once: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        sound.unlock();
        sound.toggleMuted();
        sound.play("click");
      }}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Unmute" : "Mute"}
      className="hover-lift"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        width: "46px",
        height: "46px",
        borderRadius: "14px",
        border: "1px solid var(--panel-line-strong)",
        background: "var(--panel-strong)",
        backdropFilter: "blur(10px)",
        color: muted ? "var(--faint)" : "var(--accent)",
      }}
    >
      {muted ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
