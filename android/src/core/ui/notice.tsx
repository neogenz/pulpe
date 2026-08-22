import type { ComponentProps } from "react";
import { Snackbar, useTheme } from "react-native-paper";

import { FAB_CLEARANCE } from "@/core/ui/theme";

type SnackbarProps = ComponentProps<typeof Snackbar>;

interface NoticeProps extends SnackbarProps {
  /**
   * The screen underneath has a FAB. Android stacks by elevation before it
   * stacks by tree order, so a FAB drawn at level 6 comes out on top of a
   * snackbar at level 3 however late the snackbar is written — the way out is
   * not to overlap it at all.
   */
  clearsFab?: boolean;
}

/**
 * Every toast in the app, in the app's own colours.
 *
 * MD3 asks a snackbar to invert its surroundings, and Paper obliges by painting
 * it `inverseSurface` over `inverseOnSurface`. In a light theme that is a dark
 * bar on a light page, which is exactly right. In a dark one it is a near-white
 * slab across a near-black screen — correct by the spec, and a flashbang in
 * practice on the screen where "Prévision ajoutée" appears.
 *
 * So the inversion is kept where it works and dropped where it does not, as a
 * theme override rather than a repaint of `inverseSurface` itself: that role is
 * read by other Paper components, and it is not wrong — only its use here was.
 */
export function Notice({
  clearsFab = false,
  wrapperStyle,
  ...rest
}: NoticeProps) {
  const theme = useTheme();

  const colors = theme.dark
    ? {
        inverseSurface: theme.colors.elevation.level3,
        inverseOnSurface: theme.colors.onSurface,
        inversePrimary: theme.colors.primary,
      }
    : undefined;

  return (
    <Snackbar
      {...rest}
      theme={colors === undefined ? undefined : { colors }}
      wrapperStyle={[clearsFab && { bottom: FAB_CLEARANCE }, wrapperStyle]}
    />
  );
}
