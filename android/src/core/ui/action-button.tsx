import type { ComponentProps } from "react";
import { Button, useTheme } from "react-native-paper";

import { useFinancialColors } from "@/core/ui/scheme-colors";

type PaperButtonProps = ComponentProps<typeof Button>;

interface ActionButtonProps extends Omit<
  PaperButtonProps,
  "mode" | "buttonColor"
> {
  /**
   * `primary` is the one filled action a screen has. `secondary` sits beside or
   * under it. `destructive` is reserved for what cannot be undone — it is the
   * only place true red is allowed.
   */
  variant?: "primary" | "secondary" | "destructive";
}

/**
 * Paper's own M3 button, named by intent: `contained` for the primary action,
 * `outlined` for the one beside it, and the destructive red as the only colour
 * a caller cannot pick by accident. Its height, shape and label are Material's —
 * the screen's main act is the FAB, so this is never dressed up to replace it.
 */
export function ActionButton({
  variant = "primary",
  ...rest
}: ActionButtonProps) {
  const theme = useTheme();
  const financial = useFinancialColors();

  const mode = variant === "secondary" ? "outlined" : "contained";
  const buttonColor =
    variant === "destructive" ? financial.destructive : undefined;
  const textColor =
    variant === "destructive" ? theme.colors.onError : rest.textColor;

  return (
    <Button
      {...rest}
      mode={mode}
      buttonColor={buttonColor}
      textColor={textColor}
    />
  );
}
