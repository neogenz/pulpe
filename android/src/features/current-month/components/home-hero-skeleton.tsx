import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { useHeroColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

const EYEBROW_WIDTH = 160;
const AMOUNT_WIDTH = 200;
const BAR_HEIGHT = { eyebrow: 16, amount: 44, chart: 120 } as const;

/**
 * The hero's shape before its numbers: the mint surface at its final size,
 * three quiet bars where the eyebrow, the figure and the curve will land. No
 * shimmer — the details arrive within a second, and a page that paints its
 * layout once is calmer than one that animates a wait.
 */
export function HomeHeroSkeleton() {
  const hero = useHeroColors();
  const theme = useTheme();
  const { t } = useTranslation();
  const tone = { backgroundColor: theme.colors.surfaceVariant };

  return (
    <View
      testID="home-hero-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={[styles.card, { backgroundColor: hero.surface }]}
    >
      <View style={[styles.bar, styles.eyebrow, tone]} />
      <View style={[styles.bar, styles.amount, tone]} />
      <View style={[styles.bar, styles.chart, tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    gap: SPACING.lg,
    alignItems: "center",
  },
  bar: { borderRadius: RADIUS.sm },
  eyebrow: { width: EYEBROW_WIDTH, height: BAR_HEIGHT.eyebrow },
  amount: { width: AMOUNT_WIDTH, height: BAR_HEIGHT.amount },
  chart: { alignSelf: "stretch", height: BAR_HEIGHT.chart },
});
