import type { ReactNode } from "react";
import { Appbar } from "react-native-paper";

import { ScreenAppBar } from "./screen-app-bar";

interface TabHeaderProps {
  title: string;
  /** Right-aligned action, the account icon on the home. */
  trailing?: ReactNode;
}

/**
 * The top app bar the four tabs wear: the same bar as a pushed screen, with a
 * title and no back action. Paper adds the status bar height itself, so the
 * screen underneath must not ask the safe area for the top edge as well.
 */
export function TabHeader({ title, trailing }: TabHeaderProps) {
  return (
    <ScreenAppBar>
      <Appbar.Content title={title} />
      {trailing}
    </ScreenAppBar>
  );
}
