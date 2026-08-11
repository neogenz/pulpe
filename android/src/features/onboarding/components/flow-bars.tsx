import { getCurrencyFormatter, type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

const BAR_HEIGHT = 8;
const FULL_WIDTH_PERCENT = 100;

interface Flow {
  label: string;
  amount: number;
  accent: keyof (typeof FINANCIAL_COLORS)["light"];
}

/**
 * The three flows drawn to the same scale, so what the user reads is the
 * proportion rather than three numbers they would have to divide themselves.
 * Widths are relative to the largest flow — against the income instead, the two
 * expense bars would be unreadable slivers for anyone who saves little.
 */
export function FlowBars({
  flows,
  currency,
}: {
  flows: Flow[];
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const palette = FINANCIAL_COLORS[scheme === "dark" ? "dark" : "light"];
  const formatter = getCurrencyFormatter(currency);
  const largest = Math.max(...flows.map((flow) => flow.amount));

  return (
    <View style={styles.list}>
      {flows.map((flow) => (
        <View key={flow.label} style={styles.row}>
          <View style={styles.labels}>
            <Text variant="bodyMedium">{flow.label}</Text>
            <Text variant="bodyMedium" style={TABULAR_DIGITS}>
              {formatter.format(flow.amount)}
            </Text>
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
                  backgroundColor: palette[flow.accent],
                  width: `${largest > 0 ? (flow.amount / largest) * FULL_WIDTH_PERCENT : 0}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.md },
  row: { gap: SPACING.xs },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  track: {
    height: BAR_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: BAR_HEIGHT, borderRadius: RADIUS.full },
});
