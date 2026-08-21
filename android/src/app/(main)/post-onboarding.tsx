import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Stack, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import { acknowledgeHandoff } from "@/features/onboarding/onboarding-store";

/**
 * Shown once, between the flow and the app. The budget that just got created is
 * a plan; what makes it worth anything is the habit of pointing lines as they
 * happen, and nothing else in the app ever gets to explain that from scratch.
 */
export default function PostOnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  function enterApp() {
    acknowledgeHandoff();
    router.replace("/home");
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {/* A handoff, not a destination: it has one CTA and no way back. */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      <View style={styles.body}>
        <View style={styles.intro}>
          <Text variant="headlineMedium">{t("main.handoff.title")}</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("main.handoff.intro")}
          </Text>
        </View>

        <View style={styles.steps}>
          <RitualStep
            icon="checkbox-marked-circle-outline"
            title={t("main.handoff.point.title")}
            description={t("main.handoff.point.description")}
          />
          <RitualStep
            icon="eye-outline"
            title={t("main.handoff.review.title")}
            description={t("main.handoff.review.description")}
          />
          <RitualStep
            icon="calendar-month-outline"
            title={t("main.handoff.future.title")}
            description={t("main.handoff.future.description")}
          />
        </View>
      </View>

      <Button mode="contained" onPress={enterApp}>
        {t("main.handoff.start")}
      </Button>
    </SafeAreaView>
  );
}

function RitualStep({
  icon,
  title,
  description,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepIcon,
          { backgroundColor: theme.colors.secondaryContainer },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={ICON_SIZE.xl}
          color={theme.colors.onSecondaryContainer}
        />
      </View>
      <View style={styles.stepText}>
        <Text variant="titleSmall">{title}</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: SPACING.lg, gap: SPACING.xl },
  /**
   * The slack belongs above the button, not below it: centring the whole screen
   * left the primary action floating a third of the way up with nothing under it.
   */
  body: { flex: 1, justifyContent: "center", gap: SPACING.xl },
  intro: { gap: SPACING.xs },
  steps: { gap: SPACING.lg },
  step: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  stepIcon: {
    width: SPACING.xxl,
    height: SPACING.xxl,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, gap: SPACING.xxs },
});
