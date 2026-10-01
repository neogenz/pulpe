import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { Button, useTheme } from "react-native-paper";

import { useFinancialColors } from "@/core/ui/scheme-colors";
import { BUTTON_HEIGHT } from "@/core/ui/theme";

type PaperButtonProps = ComponentProps<typeof Button>;

interface ActionButtonProps extends Omit<
  PaperButtonProps,
  "mode" | "contentStyle" | "buttonColor"
> {
  /**
   * `primary` is the one filled action a screen has. `secondary` sits beside or
   * under it. `destructive` is reserved for what cannot be undone — it is the
   * only place true red is allowed.
   */
  variant?: "primary" | "secondary" | "destructive";
}

/**
 * A full-width pill at the height iOS gives its `PrimaryButtonStyle`: the act a
 * screen exists for (`Ajouter une opération`, `Ajouter une prévision`) sits in
 * the content as a labelled action, where it can be read, rather than as a
 * floating button that covers the last row of every list.
 */
export function ActionButton({
  variant = "primary",
  style,
  labelStyle,
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
      style={[styles.button, style]}
      contentStyle={styles.content}
      labelStyle={[styles.label, labelStyle]}
    />
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "stretch" },
  content: { height: BUTTON_HEIGHT },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
});
