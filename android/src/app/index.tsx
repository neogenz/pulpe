import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { useLandingPreference } from "@/core/navigation/landing-preference";
import { landingRoute } from "@/core/navigation/route-gates";
import { SPACING } from "@/core/ui/theme";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";
import { useOnboardingStore } from "@/features/onboarding/onboarding-store";

/**
 * The landing decision has to live on a route that no guard can remove.
 * `Stack.Protected` drops a guarded screen from the navigator rather than
 * redirecting away from it, so if `/` belonged to the protected group, signing
 * out would leave the router pointing at a route that no longer exists — a
 * blank screen, which is exactly what happened.
 *
 * Where it sends the user lives in `landingRoute`, next to the predicates that
 * say which groups exist, so the two cannot disagree unnoticed.
 */
export default function IndexRoute() {
  const status = useSessionStore((state) => state.status);
  const vaultStatus = useVaultStore((state) => state.status);
  const bootstrapError = useVaultStore((state) => state.bootstrapError);
  const isOnboarding = useOnboardingStore((state) => state.isFlowActive);
  const hasCompletedOnboarding = useOnboardingStore(
    (state) => state.hasCompletedOnboarding,
  );
  const hasSeenHandoff = useOnboardingStore((state) => state.hasSeenHandoff);
  const prefersSignIn = useLandingPreference((state) => state.prefersSignIn);

  const route = landingRoute({
    status,
    vaultStatus,
    isOnboarding,
    hasCompletedOnboarding,
    hasSeenHandoff,
    prefersSignIn,
  });

  if (route !== null) return <Redirect href={route} />;
  // Nothing to route to yet: either the session is still resolving, or the user
  // is signed in and the vault has not answered. Everything past this point
  // reads encrypted amounts, so a spinner is all there is to show.
  if (status === "loading") return null;
  return <VaultBootstrapScreen errorMessage={bootstrapError} />;
}

function VaultBootstrapScreen({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {errorMessage === null ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      ) : (
        <>
          <Text variant="bodyMedium" style={styles.message}>
            {t("startup.vaultError")}
          </Text>
          <Button mode="contained" onPress={() => void bootstrapVault()}>
            {t("common.retry")}
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  message: { textAlign: "center" },
});
