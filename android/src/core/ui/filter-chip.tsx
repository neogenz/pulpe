import { Chip } from "react-native-paper";
import type { ComponentProps } from "react";

type ChipProps = ComponentProps<typeof Chip>;

/**
 * One choice in a row of them: the selected month, the kind being filtered on.
 *
 * Paper's flat chip paints `secondaryContainer` whether or not it is selected,
 * and signals the selection with a leading check alone — so a rail that hides
 * the check to keep its labels short comes out as five identical mint pills
 * with nothing saying which month you are looking at. Selection is carried by
 * the fill instead, the way Material means a filter chip to work and the way
 * the budget list already reads: filled is the one you are on, outlined is one
 * you could go to.
 */
export function FilterChip({
  selected,
  ...rest
}: Omit<ChipProps, "mode" | "showSelectedCheck">) {
  return (
    <Chip
      {...rest}
      selected={selected}
      mode={selected === true ? "flat" : "outlined"}
      showSelectedCheck={false}
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
