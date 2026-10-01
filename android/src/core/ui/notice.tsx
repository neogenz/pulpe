import type { ComponentProps } from "react";
import { Snackbar, useTheme } from "react-native-paper";

import { FOOTER_CLEARANCE } from "@/core/ui/theme";

type SnackbarProps = ComponentProps<typeof Snackbar>;

interface NoticeProps extends SnackbarProps {
  /**
   * The screen underneath pins its action to the bottom edge. A snackbar drawn
   * over it hides the very button the page is for — the way out is not to
   * overlap it at all.
   */
  clearsFooter?: boolean;
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
  clearsFooter = false,
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
      wrapperStyle={[
        clearsFooter && { bottom: FOOTER_CLEARANCE },
        wrapperStyle,
      ]}
    />
  );
}
