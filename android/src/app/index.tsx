import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { SPACING } from "@/core/ui/theme";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";

/**
 * The landing decision has to live on a route that no guard can remove.
 * `Stack.Protected` drops a guarded screen from the navigator rather than
 * redirecting away from it, so if `/` belonged to the protected group, signing
 * out would leave the router pointing at a route that no longer exists — a
 * blank screen, which is exactly what happened.
 */
export default function IndexRoute() {
  const status = useSessionStore((state) => state.status);
  const vaultStatus = useVaultStore((state) => state.status);
  const bootstrapError = useVaultStore((state) => state.bootstrapError);

  if (status === "loading") return null;
  if (status === "unauthenticated") return <Redirect href="/sign-in" />;

  switch (vaultStatus) {
    case "setupRequired":
      return <Redirect href="/vault-setup" />;
    case "locked":
      return <Redirect href="/vault-unlock" />;
    case "unlocked":
      return <Redirect href="/home" />;
    case "unknown":
      // Signed in, but the vault has not answered yet. Everything past this
      // point reads encrypted amounts, so there is nothing to show meanwhile.
      return <VaultBootstrapScreen errorMessage={bootstrapError} />;
  }
}

function VaultBootstrapScreen({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {errorMessage === null ? (
        <ActivityIndicator accessibilityLabel="Chargement" />
      ) : (
        <>
          <Text variant="bodyMedium" style={styles.message}>
            {errorMessage}
          </Text>
          <Button mode="contained" onPress={() => void bootstrapVault()}>
            Réessayer
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
