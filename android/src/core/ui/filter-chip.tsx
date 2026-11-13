import { Chip, useTheme } from "react-native-paper";
import type { ComponentProps } from "react";

import { useV2Colors } from "@/core/ui/scheme-colors";

type ChipProps = ComponentProps<typeof Chip>;

/**
 * One choice in a row of them: the selected month, the kind being filtered on.
 * `PulpeChip` on iOS.
 *
 * Selected, it is the pale green wash ringed in the action green, with a
 * check, in the wash's own ink; idle, a white capsule with a quiet border.
 * Two signals rather than one, so the selection survives a colour-blind eye
 * and a dark theme alike.
 */
export function FilterChip({
  selected,
  style,
  ...rest
}: Omit<ChipProps, "mode">) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const isSelected = selected === true;

  return (
    <Chip
      {...rest}
      selected={selected}
      mode="outlined"
      selectedColor={isSelected ? v2.accentInk : theme.colors.onSurface}
      style={[
        {
          backgroundColor: isSelected ? v2.accentWash : theme.colors.surface,
          borderColor: isSelected ? theme.colors.primary : v2.line2,
          borderWidth: isSelected ? SELECTED_RING : 1,
        },
        style,
      ]}
      // Paper sets no minimum height on an MD3 chip: six points of margin
      // around a 20-point line comes out at 32, sixteen short of Material's
      // floor, on the row this app asks the most taps of. The slop is what
      // Paper hands down to its own `TouchableRipple`, so the chip keeps its
      // drawn size and answers across 48.
      hitSlop={CHIP_SLOP}
    />
  );
}

/** Half of what `TOUCH_TARGET` is missing, taken on each side. */
const CHIP_SLOP = 8;
const SELECTED_RING = 1.5;
