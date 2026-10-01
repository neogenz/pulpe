import { type Href, router } from "expo-router";
import { useRef } from "react";

/** Long enough to swallow a double tap, short enough never to eat a second visit. */
const DOUBLE_TAP_MS = 600;

/**
 * `router.push` that a double tap cannot fire twice. A quick second tap on a
 * row used to stack the same screen a second time: back had to be pressed
 * twice, and each copy fetched on its own. The guard is per screen instance,
 * so leaving and coming back always navigates.
 */
export function usePushOnce(): (href: Href) => void {
  const last = useRef<{ key: string; at: number } | null>(null);

  return (href: Href) => {
    const key = typeof href === "string" ? href : JSON.stringify(href);
    const now = Date.now();
    if (
      last.current !== null &&
      last.current.key === key &&
      now - last.current.at < DOUBLE_TAP_MS
    ) {
      return;
    }
    last.current = { key, at: now };
    router.push(href);
  };
}
