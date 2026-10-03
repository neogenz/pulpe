import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ReactNode, useRef } from "react";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticCommit } from "@/core/ui/haptics";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";

/** How far the row has to travel before letting go commits. */
const COMMIT_DISTANCE = 72;
/** The strip uncovered under the row, wide enough for its icon and word. */
const ACTION_WIDTH = 168;

interface SwipeToPointProps {
  isChecked: boolean;
  /** The row's own nature colour, which the strip is painted in. */
  tint: string;
  /** Off where the row cannot be pointed here — a goal's announced withdrawal. */
  isEnabled: boolean;
  onPoint: () => void;
  /**
   * The row, handed `guard` to wrap its taps with: a finger lifted at the end
   * of a drag must not also count as a tap on the row it dragged.
   */
  children: (guard: TapGuard) => ReactNode;
}

/** Wraps a tap handler so it stays silent while the row is being dragged. */
export type TapGuard = <T extends unknown[]>(
  handler: ((...args: T) => void) | undefined,
) => ((...args: T) => void) | undefined;

/**
 * The second way to point a row, after its disc: drag it to the right. Past the
 * threshold, letting go points it — or takes the pointing back — and the row
 * springs home, the way a message is archived in Gmail. Nothing is uncovered
 * to be tapped afterwards: that is the iOS swipe action, and on Android a
 * swipe that went far enough has already done its job.
 */
export function SwipeToPoint({
  isChecked,
  tint,
  isEnabled,
  onPoint,
  children,
}: SwipeToPointProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const swipeable = useRef<SwipeableMethods>(null);
  // Set when a drag starts, cleared once the row is home again — after the
  // release has delivered whatever tap it was going to.
  const isDragging = useRef(false);
  const guard: TapGuard = (handler) =>
    handler === undefined
      ? undefined
      : (...args) => {
          if (!isDragging.current) handler(...args);
        };
  const background = isChecked ? theme.colors.surfaceVariant : tint;
  const ink = isChecked
    ? theme.colors.onSurfaceVariant
    : theme.colors.onPrimary;

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      enabled={isEnabled}
      friction={1.5}
      leftThreshold={COMMIT_DISTANCE}
      overshootLeft={false}
      // The row is drawn on the card's paper; without its own, the strip
      // underneath would show through it before the drag even starts.
      childrenContainerStyle={{ backgroundColor: theme.colors.surface }}
      renderLeftActions={() => (
        <View
          style={[styles.action, { backgroundColor: background }]}
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialCommunityIcons
            name={isChecked ? "undo-variant" : "check"}
            size={ICON_SIZE.lg}
            color={ink}
          />
          <Text
            variant="labelLarge"
            numberOfLines={1}
            style={[styles.label, { color: ink }]}
          >
            {t(`budgets.detail.swipe.${isChecked ? "unpoint" : "point"}`)}
          </Text>
        </View>
      )}
      onSwipeableOpenStartDrag={() => {
        isDragging.current = true;
      }}
      onSwipeableClose={() => {
        isDragging.current = false;
      }}
      onSwipeableWillOpen={hapticCommit}
      onSwipeableOpen={() => {
        onPoint();
        swipeable.current?.close();
      }}
    >
      {children(guard)}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  label: { flexShrink: 1 },
});
