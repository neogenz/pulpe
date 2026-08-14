import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

const BAR_HEIGHT = 8;
const FULL_WIDTH_PERCENT = 100;

interface Flow {
  label: string;
  amount: number;
  accent: "income" | "expense" | "savings";
  /** Absent while the flows are only being shown, present when they lead back. */
  onPress?: () => void;
}

/**
 * The three flows drawn to the same scale, so what the user reads is the
 * proportion rather than three numbers they would have to divide themselves.
 * Widths are relative to the largest flow — against the income instead, the two
 * expense bars would be unreadable slivers for anyone who saves little.
 *
 * A row that leads somewhere is the row itself: the recap used to print the
 * same three flows twice, once as bars and once as a stack of "Modifier mes
 * revenus" buttons underneath, which is the screen telling you what it already
 * showed you.
 */
export function FlowBars({
  flows,
  currency,
}: {
  flows: Flow[];
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const ripple = useRipple();
  const largest = Math.max(...flows.map((flow) => flow.amount));

  return (
    <View style={styles.list}>
      {flows.map((flow) => (
        <Pressable
          key={flow.label}
          style={styles.row}
          onPress={flow.onPress}
          android_ripple={ripple}
          disabled={flow.onPress === undefined}
          accessibilityRole={flow.onPress === undefined ? undefined : "button"}
          accessibilityHint={
            flow.onPress === undefined
              ? undefined
              : `Revenir à l'étape ${flow.label.toLowerCase()}`
          }
        >
          <View style={styles.labels}>
            <Text variant="bodyMedium">{flow.label}</Text>
            <View style={styles.amount}>
              <Amount size="row">
                {formatCompactCurrency(flow.amount, currency)}
              </Amount>
              {flow.onPress !== undefined && (
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={ICON_SIZE.sm}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
            </View>
          </View>
          <View
            style={[
              styles.track,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: financial[flow.accent],
                  width: `${largest > 0 ? (flow.amount / largest) * FULL_WIDTH_PERCENT : 0}%`,
                },
              ]}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.md },
  row: { gap: SPACING.xs, paddingVertical: SPACING.xs },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  amount: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  track: {
    height: BAR_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: BAR_HEIGHT, borderRadius: RADIUS.full },
});
