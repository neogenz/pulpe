import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { hapticSelection } from "@/core/ui/haptics";
import { useV2Colors } from "@/core/ui/scheme-colors";
import {
  ACCESSIBLE_FONT_SCALE,
  EMPHASIS,
  RADIUS,
  SPACING,
  TOUCH_TARGET,
} from "@/core/ui/theme";

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
  /**
   * Drawn on a recessed card, which already has the track's colour: the track
   * turns into an outline, each segment a full 48dp target, and the chosen one
   * takes the selected-chip fill, which still reads on the dark card.
   */
  isOnCard?: boolean;
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
  isOnCard = false,
}: SegmentedPickerProps<T>) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const wrapsLabels = useWindowDimensions().fontScale >= ACCESSIBLE_FONT_SCALE;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        isOnCard
          ? { ...styles.outlined, borderColor: theme.colors.outline }
          : { backgroundColor: v2.sunk },
      ]}
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
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            android_ripple={{ color: v2.line2, borderless: false }}
            hitSlop={{ top: SPACING.xs, bottom: SPACING.xs }}
            style={[
              styles.segment,
              isOnCard && styles.fullTarget,
              isSelected &&
                (isOnCard
                  ? { backgroundColor: theme.colors.secondaryContainer }
                  : {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outline,
                      elevation: 1,
                    }),
              isDisabled && { opacity: EMPHASIS.disabled },
            ]}
          >
            <Text
              variant="labelLarge"
              numberOfLines={wrapsLabels ? undefined : 1}
              adjustsFontSizeToFit={!wrapsLabels}
              minimumFontScale={0.8}
              style={{
                textAlign: "center",
                color: !isSelected
                  ? theme.colors.onSurfaceVariant
                  : isOnCard
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurface,
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
  outlined: { borderWidth: 1 },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fullTarget: { minHeight: TOUCH_TARGET },
});
