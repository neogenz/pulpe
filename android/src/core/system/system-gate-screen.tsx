import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Linking, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SPACING } from "@/core/ui/theme";

import {
  checkSystemGate,
  type SystemGate,
  useSystemStore,
} from "./system-store";

const ANIMATION_SIZE = 220;

interface GateCopy {
  title: string;
  hint: string;
  actionLabel: string;
}

const COPY: Record<Exclude<SystemGate, "ok">, GateCopy> = {
  maintenance: {
    title: "Pulpe est en maintenance",
    hint: "On remet les compteurs d'aplomb. Reviens dans quelques minutes.",
    actionLabel: "Réessayer",
  },
  forceUpdate: {
    title: "Une mise à jour t'attend",
    hint: "Cette version n'est plus prise en charge. Installe la dernière pour retrouver tes budgets.",
    actionLabel: "Mettre à jour",
  },
  offline: {
    title: "Pas de connexion",
    hint: "Tes budgets sont chiffrés côté serveur : sans réseau, Pulpe ne peut rien afficher.",
    actionLabel: "Réessayer",
  },
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
  const theme = useTheme();
  const gate = useSystemStore((state) => state.gate);
  const storeUrl = useSystemStore((state) => state.storeUrl);
  const isChecking = useSystemStore((state) => state.isChecking);
  const shouldReduceMotion = useReducedMotion();

  if (gate === "ok") return null;

  const copy = COPY[gate];
  const isUpdate = gate === "forceUpdate";
  // Without a published store URL there is nothing to send the user to, so the
  // button falls back to re-asking — the backend may have moved the floor.
  const canOpenStore = isUpdate && storeUrl !== null;

  return (
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
          {copy.title}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
        >
          {copy.hint}
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
        {canOpenStore ? copy.actionLabel : "Réessayer"}
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  animation: { width: ANIMATION_SIZE, height: ANIMATION_SIZE },
  copy: { gap: SPACING.sm },
  centered: { textAlign: "center" },
});
