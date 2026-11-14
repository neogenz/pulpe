import { StatusBar } from "expo-status-bar";

/**
 * The scheme's own status bar icons everywhere: since the V2 boards every
 * screen sits on the canvas. One declaration, mounted at the root, so no two
 * screens ever compete for the bar.
 */
export function RouteStatusBar() {
  return <StatusBar style="auto" />;
}
