import { Redirect } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import { ActivityIndicator, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { useLandingPreference } from "@/core/navigation/landing-preference";
import { landingRoute } from "@/core/navigation/route-gates";
import { APP_URLS } from "@/core/ui/app-urls";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import {
  bootstrapVault,
  useVaultStore,
  type VaultBootstrapFailure,
} from "@/core/vault/vault-store";
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
  const bootstrapFailure = useVaultStore((state) => state.bootstrapFailure);
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
  return <VaultBootstrapScreen failure={bootstrapFailure} />;
}

/**
 * Signing out is always offered: a vault that keeps refusing — a session
 * revoked elsewhere and not refreshable, an account on its way out — left the
 * user on a retry that could never get past it.
 */
function VaultBootstrapScreen({
  failure,
}: {
  failure: VaultBootstrapFailure | null;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const signOut = useSessionStore((state) => state.signOut);

  if (failure === null) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </View>
    );
  }

  const signOutAction = {
    label: t("common.signOut"),
    onPress: () => void signOut().catch(() => undefined),
  };

  if (failure === "accountBlocked") {
    return (
      <PlaceholderScreen
        icon="account-cancel-outline"
        title={t("startup.accountBlocked.title")}
        hint={t("startup.accountBlocked.hint")}
        action={{
          label: t("common.contactSupport"),
          onPress: () => void Linking.openURL(APP_URLS.support),
        }}
        secondaryAction={signOutAction}
      />
    );
  }

  return (
    <PlaceholderScreen
      icon="cloud-off-outline"
      title={t("startup.vaultError")}
      hint={t("common.loadErrorHint")}
      action={{
        label: t("common.retry"),
        onPress: () => void bootstrapVault(),
      }}
      secondaryAction={signOutAction}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
