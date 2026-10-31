import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render and hydration, true afterwards. Avoids hydration mismatches. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
