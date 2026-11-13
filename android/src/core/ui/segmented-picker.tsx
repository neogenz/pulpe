import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { hapticSelection } from "@/core/ui/haptics";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { EMPHASIS, RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";

interface Segment<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  testID?: string;
}

interface SegmentedPickerProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  buttons: readonly Segment<T>[];
  accessibilityLabel?: string;
}

/**
 * A choice among two or three, on the V2 board: a recessed capsule track and a
 * white capsule under the one in force — `SegmentedPicker` on iOS. Takes the
 * props of Paper's `SegmentedButtons`, which it replaces.
 */
export function SegmentedPicker<T extends string>({
  value,
  onValueChange,
  buttons,
  accessibilityLabel,
}: SegmentedPickerProps<T>) {
  const theme = useTheme();
  const v2 = useV2Colors();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: v2.sunk }]}
    >
      {buttons.map((segment) => {
        const isSelected = segment.value === value;
        const isDisabled = segment.disabled === true;
        return (
          <Pressable
            key={segment.value}
            testID={segment.testID}
            disabled={isDisabled}
            onPress={() => {
              if (isSelected) return;
              hapticSelection();
              onValueChange(segment.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            android_ripple={{ color: v2.line2, borderless: false }}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: theme.colors.surface,
                elevation: 1,
              },
              isDisabled && { opacity: EMPHASIS.disabled },
            ]}
          >
            <Text
              variant="labelLarge"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                color: isSelected
                  ? theme.colors.onSurface
                  : theme.colors.onSurfaceVariant,
              }}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
});
