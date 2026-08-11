import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import {
  dismissSubmissionError,
  submitOnboarding,
  useSubmissionStore,
} from "../onboarding-submission";

/**
 * Covers the flow while the account is being built. It is deliberately not a
 * step: the user has nothing left to answer, and the step underneath is what
 * they return to if the creation fails.
 */
export function SubmissionOverlay() {
  const theme = useTheme();
  const status = useSubmissionStore((state) => state.status);
  const errorMessage = useSubmissionStore((state) => state.errorMessage);

  if (status === "idle") return null;

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.colors.background }]}
      accessibilityViewIsModal
    >
      {status === "submitting" ? (
        <>
          <ActivityIndicator accessibilityLabel="Création de ton budget" />
          <Text variant="bodyMedium" style={styles.centered}>
            On prépare tes treize prochains mois…
          </Text>
        </>
      ) : (
        <>
          <Text variant="titleMedium" style={styles.centered}>
            Ton budget n&apos;a pas pu être créé
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
          >
            {errorMessage}
          </Text>
          <Button mode="contained" onPress={() => void submitOnboarding()}>
            Réessayer
          </Button>
          {/* Nothing is lost by backing out: the answers are still in the
              draft, and the code chosen a moment ago still opens the vault. */}
          <Button onPress={dismissSubmissionError}>
            Revenir à mes réponses
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centered: { textAlign: "center" },
});
