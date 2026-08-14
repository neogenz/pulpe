import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useRipple } from "@/core/ui/ripple";
import { EMPHASIS, ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

export const PIN_LENGTH = 4;

const KEY_SIZE = 76;
const DOT_SIZE = 16;
const DOT_BORDER_WIDTH = 2;
/** Reserved so the numpad does not jump when a message appears under the dots. */
const MESSAGE_HEIGHT = 20;

type PadKey = { digit: string } | { action: "backspace" } | { action: "blank" };

const PAD_KEYS: PadKey[] = [
  ...["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => ({ digit })),
  { action: "blank" },
  { digit: "0" },
  { action: "backspace" },
];

interface PinDotsProps {
  filled: number;
  hasError: boolean;
}

/**
 * The dots are the only feedback the user gets — the digits themselves are
 * never echoed — so they carry both the progress and the failure.
 */
const PinDots = memo(function PinDots({ filled, hasError }: PinDotsProps) {
  const theme = useTheme();
  const activeColor = hasError ? theme.colors.error : theme.colors.primary;

  return (
    <View
      style={styles.dots}
      accessibilityRole="progressbar"
      accessibilityLabel={`${filled} chiffre sur ${PIN_LENGTH}`}
    >
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < filled
              ? { backgroundColor: activeColor, borderColor: activeColor }
              : { borderColor: theme.colors.outlineVariant },
          ]}
        />
      ))}
    </View>
  );
});

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  /** Shown under the dots, which turn to the error colour with it. */
  errorMessage?: string | null;
  isDisabled?: boolean;
  /** Rendered in the blank slot next to the zero — the biometric affordance. */
  accessory?: React.ReactNode;
}

export function PinPad({
  value,
  onChange,
  errorMessage = null,
  isDisabled = false,
  accessory,
}: PinPadProps) {
  const theme = useTheme();
  const ripple = useRipple({ radius: KEY_SIZE / 2 });
  const hasError = errorMessage !== null;

  const press = useCallback(
    (key: PadKey) => {
      if (isDisabled) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if ("digit" in key) {
        if (value.length >= PIN_LENGTH) return;
        onChange(value + key.digit);
        return;
      }
      if (key.action === "backspace") onChange(value.slice(0, -1));
    },
    [isDisabled, onChange, value],
  );

  return (
    <View style={styles.container}>
      <View style={styles.status}>
        <PinDots filled={value.length} hasError={hasError} />
        <Text
          variant="bodySmall"
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: theme.colors.error }]}
        >
          {errorMessage ?? ""}
        </Text>
      </View>

      <View style={styles.grid}>
        {PAD_KEYS.map((key, index) => {
          if ("action" in key && key.action === "blank") {
            return (
              <View key={index} style={styles.key}>
                {accessory}
              </View>
            );
          }

          const isBackspace = "action" in key;
          return (
            <Pressable
              key={index}
              onPress={() => press(key)}
              disabled={isDisabled}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={isBackspace ? "Effacer" : key.digit}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed
                    ? theme.colors.surfaceVariant
                    : "transparent",
                  opacity: isDisabled ? EMPHASIS.disabled : 1,
                },
              ]}
            >
              {isBackspace ? (
                <MaterialCommunityIcons
                  name="backspace-outline"
                  size={ICON_SIZE.lg}
                  color={theme.colors.onSurfaceVariant}
                />
              ) : (
                <Text
                  variant="headlineSmall"
                  style={{ color: theme.colors.onSurface }}
                >
                  {key.digit}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: SPACING.xl },
  status: { alignItems: "center", gap: SPACING.md },
  message: { height: MESSAGE_HEIGHT, textAlign: "center" },
  dots: { flexDirection: "row", gap: SPACING.md },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: DOT_BORDER_WIDTH,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: KEY_SIZE * 3 + SPACING.md * 2,
    gap: SPACING.md,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
