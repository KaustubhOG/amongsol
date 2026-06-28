import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// Returns false during server rendering and the first paint, true once mounted
// on the client. Implemented with useSyncExternalStore so it needs no effect
// and never calls setState during an effect.
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
