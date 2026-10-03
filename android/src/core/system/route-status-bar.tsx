import { usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { isHeroPath } from "@/core/navigation/hero-routes";

/**
 * Light status bar icons over a forest hero, the scheme's own everywhere else.
 * One declaration for the whole app, mounted at the root, so no two screens
 * ever compete for the bar.
 */
export function RouteStatusBar() {
  const pathname = usePathname();
  return <StatusBar style={isHeroPath(pathname) ? "light" : "auto"} />;
}
