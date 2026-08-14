import { useTheme } from "react-native-paper";

import { TINT_ALPHA } from "@/core/ui/theme";

/**
 * The acknowledgement Android expects the instant a finger lands, before any
 * navigation or mutation has resolved. `onSurface` at the pressed-state alpha,
 * so one ripple reads on every surface the app paints and no call site has to
 * pick a colour.
 *
 * A control that draws its own shape — a ring, a round key — passes
 * `borderless` with its radius, so the ripple stays inside the shape instead of
 * washing the rectangle the shape happens to sit in.
 */
export function useRipple(borderless?: { radius: number }) {
  const theme = useTheme();
  const color = `${theme.colors.onSurface}${TINT_ALPHA.surface}`;

  return borderless === undefined
    ? { color }
    : { color, borderless: true, radius: borderless.radius };
}
