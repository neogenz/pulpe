import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { useV2Colors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, RADIUS, SCREEN_PADDING, SPACING } from "@/core/ui/theme";

/** What a month that has not started is: its prévisions come from the model, and can still change. */
export function UpcomingBanner() {
  const theme = useTheme();
  const v2 = useV2Colors();
  const { t } = useTranslation();

  return (
    <View style={styles.gutter}>
      <View
        accessible
        accessibilityRole="summary"
        style={[styles.banner, { backgroundColor: v2.sunk }]}
      >
        <MaterialCommunityIcons
          name="calendar-outline"
          size={ICON_SIZE.lg}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="bodyMedium" style={styles.text}>
          {t("budgets.detail.upcomingBanner")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACING.sm },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
  text: { flex: 1 },
});
