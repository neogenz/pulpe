import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Linking, Modal, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";

import {
  checkSystemGate,
  type SystemGate,
  useSystemStore,
} from "./system-store";

const ANIMATION_SIZE = 220;

const COPY_KEYS: Record<Exclude<SystemGate, "ok">, string> = {
  maintenance: "maintenance",
  forceUpdate: "forceUpdate",
};

/**
 * Rendered above the navigator rather than as a route of its own, which is
 * what makes it blocking: there is no back gesture, no deep link and no guard
 * ordering that can land the user behind it.
 *
 * Departure from the plan's three `app/*.tsx` routes — a route the router owns
 * is a route the router can leave.
 */
export function SystemGateScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const gate = useSystemStore((state) => state.gate);
  const storeUrl = useSystemStore((state) => state.storeUrl);
  const isChecking = useSystemStore((state) => state.isChecking);
  const shouldReduceMotion = useReducedMotion();

  if (gate === "ok") return null;

  const copyKey = `system.gate.${COPY_KEYS[gate]}`;
  const isUpdate = gate === "forceUpdate";
  // Without a published store URL there is nothing to send the user to, so the
  // button falls back to re-asking — the backend may have moved the floor.
  const canOpenStore = isUpdate && storeUrl !== null;

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      <SafeAreaView
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {gate === "maintenance" && (
          <LottieView
            source={require("../../../assets/lottie/maintenance-animation.json")}
            autoPlay={!shouldReduceMotion}
            loop={!shouldReduceMotion}
            style={styles.animation}
          />
        )}

        <View style={styles.copy}>
          <Text variant="headlineSmall" style={styles.centered}>
            {t(`${copyKey}.title`)}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
          >
            {t(`${copyKey}.hint`)}
          </Text>
        </View>

        <Button
          mode="contained"
          loading={isChecking}
          disabled={isChecking}
          onPress={() => {
            if (canOpenStore && storeUrl !== null) {
              void Linking.openURL(storeUrl);
              return;
            }
            void checkSystemGate();
          }}
        >
          {canOpenStore ? t(`${copyKey}.action`) : t("common.retry")}
        </Button>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  animation: { width: ANIMATION_SIZE, height: ANIMATION_SIZE },
  copy: { gap: SPACING.sm },
  centered: { textAlign: "center" },
});
