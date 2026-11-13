import type { ComponentProps } from "react";
import { Snackbar, useTheme } from "react-native-paper";

import { FAB_CLEARANCE, RADIUS } from "@/core/ui/theme";

type SnackbarProps = ComponentProps<typeof Snackbar>;

interface NoticeProps extends SnackbarProps {
  /**
   * The screen underneath has a FAB. Android stacks by elevation before it
   * stacks by tree order, so a FAB drawn at level 6 comes out on top of a
   * snackbar at level 3 however late the snackbar is written — the way out is
   * not to overlap it at all, and M3 puts the snackbar above the FAB anyway.
   */
  clearsFab?: boolean;
}

/**
 * Every toast in the app, on the V2 board: a white card with ink text and a
 * green action, in both schemes — `ToastView` on iOS. MD3 asks a snackbar to
 * invert its surroundings; the override is local to this component because
 * `inverseSurface` is read by other Paper components, and it is not wrong
 * there.
 */
export function Notice({
  clearsFab = false,
  wrapperStyle,
  style,
  ...rest
}: NoticeProps) {
  const theme = useTheme();

  return (
    <Snackbar
      {...rest}
      theme={{
        colors: {
          inverseSurface: theme.dark
            ? theme.colors.elevation.level3
            : theme.colors.surface,
          inverseOnSurface: theme.colors.onSurface,
          inversePrimary: theme.colors.primary,
        },
      }}
      style={[{ borderRadius: RADIUS.card }, style]}
      wrapperStyle={[clearsFab && { bottom: FAB_CLEARANCE }, wrapperStyle]}
    />
  );
}
