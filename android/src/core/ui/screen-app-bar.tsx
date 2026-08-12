import type { ReactNode } from "react";
import { Appbar, useTheme } from "react-native-paper";

interface ScreenAppBarProps {
  children: ReactNode;
}

/**
 * The top app bar every pushed screen wears.
 *
 * Paper paints `Appbar.Header` on `surface`, which is pure white, while a
 * screen is on `background`. The two are close enough to look like a mistake
 * and far enough to read as a foreign white slab bolted above the content —
 * and because the app draws edge to edge, that slab ran up into the status bar
 * as well. Material puts a top app bar on the same colour as the page it
 * belongs to, so that is what this does.
 *
 * It also settles a split the screens had drifted into: five wrote
 * `<Appbar.Header>` and seven wrote `<Appbar.Header mode="small"
 * elevated={false}>`, which are not the same bar. There is one now.
 */
export function ScreenAppBar({ children }: ScreenAppBarProps) {
  const theme = useTheme();

  return (
    <Appbar.Header
      mode="small"
      elevated={false}
      style={{ backgroundColor: theme.colors.background }}
    >
      {children}
    </Appbar.Header>
  );
}
