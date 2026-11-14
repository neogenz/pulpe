import { StyleSheet, View } from "react-native";

import { useHeroColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

const EYEBROW_WIDTH = 140;
const AMOUNT_WIDTH = 180;
const BAR_HEIGHT = { eyebrow: 14, amount: 48, chart: 120 } as const;

/**
 * The hero's shape before its numbers, on the white card it will land on: quiet
 * tiles where the eyebrow, the figure and the curve will be.
 * No shimmer — the details arrive within a second, and a page that paints its
 * layout once is calmer than one that animates a wait.
 */
export function HomeHeroSkeleton() {
  const hero = useHeroColors();
  const { t } = useTranslation();
  const tone = { backgroundColor: hero.tile };

  return (
    <View
      testID="home-hero-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={styles.hero}
    >
      <View style={[styles.bar, styles.eyebrow, tone]} />
      <View style={[styles.bar, styles.amount, tone]} />
      <View style={[styles.bar, styles.chart, tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.md },
  bar: { borderRadius: RADIUS.sm },
  eyebrow: { width: EYEBROW_WIDTH, height: BAR_HEIGHT.eyebrow },
  amount: { width: AMOUNT_WIDTH, height: BAR_HEIGHT.amount },
  chart: { alignSelf: "stretch", height: BAR_HEIGHT.chart },
});
