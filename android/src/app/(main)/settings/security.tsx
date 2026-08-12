import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  Dialog,
  Portal,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useSessionStore } from "@/core/auth/session-store";
import { describeBiometrics } from "@/core/crypto/biometrics";
import { SPACING } from "@/core/ui/theme";
import {
  disableVaultBiometrics,
  enableVaultBiometrics,
  renewRecoveryKey,
  useVaultStore,
} from "@/core/vault/vault-store";
import {
  useDeleteAccount,
  useUserProfile,
} from "@/features/account/account-queries";
import { ChangePasswordSheet } from "@/features/account/components/change-password-sheet";
import { ConfirmPasswordSheet } from "@/features/account/components/confirm-password-sheet";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/account/components/settings-section";
import { VerifyRecoveryKeySheet } from "@/features/account/components/verify-recovery-key-sheet";

type OpenSheet = "password" | "regenerate" | "verify" | null;

/**
 * Everything that decides who gets in and what happens when they cannot.
 * Mirrors `SecuritySettingsView` on iOS, danger zone included.
 */
export default function SecuritySettingsScreen() {
  const theme = useTheme();
  const profile = useUserProfile();
  const sessionEmail = useSessionStore((state) => state.user?.email);
  const signOut = useSessionStore((state) => state.signOut);
  const isBiometricEnabled = useVaultStore(
    (state) => state.isBiometricAvailable,
  );
  const removeAccount = useDeleteAccount();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [isDisablingBiometrics, setDisablingBiometrics] = useState(false);
  const [isDeletingAccount, setDeletingAccount] = useState(false);
  const [isBiometricBusy, setBiometricBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A device capability, asked once and cached: it cannot change while the
  // screen is up without the user leaving the app to enrol a finger.
  const biometrics = useQuery({
    queryKey: ["biometrics", "label"],
    queryFn: describeBiometrics,
    staleTime: Infinity,
  });
  const biometricLabel = biometrics.data ?? null;
  const email = profile.data?.email ?? sessionEmail ?? "";

  async function enableBiometrics() {
    setBiometricBusy(true);
    const isEnabled = await enableVaultBiometrics();
    setBiometricBusy(false);
    setNotice(
      isEnabled
        ? `${biometricLabel ?? "Déverrouillage biométrique"} activé`
        : "L'activation a échoué. Réessaie.",
    );
  }

  async function disableBiometrics() {
    setBiometricBusy(true);
    await disableVaultBiometrics();
    setBiometricBusy(false);
    setDisablingBiometrics(false);
    setNotice(`${biometricLabel ?? "Déverrouillage biométrique"} désactivé`);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Sécurité" />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title="ACCÈS">
          <SettingsRow
            icon="dialpad"
            title="Code PIN"
            description="Le code qui déchiffre tes montants"
            onPress={() => router.push("/settings/change-pin")}
          />
          <SettingsRow
            icon="lock-outline"
            title="Mot de passe"
            description="Ton mot de passe de connexion"
            isDisabled={email.length === 0}
            onPress={() => setSheet("password")}
          />
        </SettingsSection>

        <SettingsSection title="CLÉ DE RÉCUPÉRATION">
          <SettingsRow
            icon="key-outline"
            title="Vérifier ma clé"
            description="Contrôle celle que tu as notée, sans la remplacer"
            onPress={() => setSheet("verify")}
          />
          <SettingsRow
            icon="key-plus"
            title="Régénérer ma clé"
            description="L'ancienne cessera de fonctionner"
            isDisabled={email.length === 0}
            onPress={() => setSheet("regenerate")}
          />
        </SettingsSection>

        {biometricLabel !== null && (
          <SettingsSection title="BIOMÉTRIE">
            <View style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">{biometricLabel}</Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Déverrouille Pulpe sans saisir ton code PIN.
                </Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                disabled={isBiometricBusy}
                onValueChange={(next) =>
                  next ? void enableBiometrics() : setDisablingBiometrics(true)
                }
                accessibilityLabel={biometricLabel}
              />
            </View>
          </SettingsSection>
        )}

        <View style={styles.danger}>
          <Text variant="labelLarge" style={{ color: theme.colors.error }}>
            ZONE DE DANGER
          </Text>
          <Card
            mode="contained"
            style={{ backgroundColor: theme.colors.errorContainer }}
          >
            <Card.Content style={styles.dangerCard}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onErrorContainer }}
              >
                Supprimer ton compte efface définitivement tes budgets, tes
                objectifs et tes opérations après un délai de grâce.
              </Text>
              <Button
                mode="contained"
                buttonColor={theme.colors.error}
                textColor={theme.colors.onError}
                onPress={() => setDeletingAccount(true)}
              >
                Supprimer mon compte
              </Button>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Mounted only while open: each sheet seeds its fields once. */}
      {sheet === "password" && (
        <ChangePasswordSheet
          isVisible
          onDismiss={() => setSheet(null)}
          email={email}
          onChanged={() => {
            setSheet(null);
            setNotice("Mot de passe modifié");
          }}
        />
      )}

      {sheet === "regenerate" && (
        <ConfirmPasswordSheet
          isVisible
          onDismiss={() => setSheet(null)}
          email={email}
          title="Régénérer ma clé de récupération"
          message="La clé que tu as notée cessera de fonctionner. La nouvelle s'affichera une seule fois."
          onConfirmed={async () => {
            // The key itself is shown by the app-level notice the vault store
            // raises, which outlives this sheet.
            await renewRecoveryKey();
            setSheet(null);
          }}
        />
      )}

      {sheet === "verify" && (
        <VerifyRecoveryKeySheet
          isVisible
          onDismiss={() => setSheet(null)}
          onVerified={() => {
            setSheet(null);
            setNotice("Cette clé est valide pour ton compte.");
          }}
        />
      )}

      <Portal>
        <Dialog
          visible={isDisablingBiometrics}
          onDismiss={() => setDisablingBiometrics(false)}
        >
          <Dialog.Title>Désactiver {biometricLabel} ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Tu devras saisir ton code PIN à chaque déverrouillage.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDisablingBiometrics(false)}>
              Annuler
            </Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => void disableBiometrics()}
              disabled={isBiometricBusy}
            >
              Désactiver
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={isDeletingAccount}
          onDismiss={() => setDeletingAccount(false)}
        >
          <Dialog.Icon icon="alert" />
          <Dialog.Title>Supprimer mon compte</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Ton compte sera définitivement supprimé après un délai de 3 jours.
              Cette action est irréversible.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletingAccount(false)}>Annuler</Button>
            <Button
              textColor={theme.colors.error}
              disabled={removeAccount.isPending}
              loading={removeAccount.isPending}
              onPress={() =>
                removeAccount.mutate(undefined, {
                  // Signing out is the confirmation: the account is gone, so
                  // staying on a screen that reads from it would only fail.
                  onSuccess: () => void signOut(),
                  onError: () => {
                    setDeletingAccount(false);
                    setNotice("La suppression du compte a échoué.");
                  },
                })
              }
            >
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    padding: SPACING.md,
  },
  switchLabels: { flex: 1, gap: SPACING.xxs },
  danger: { gap: SPACING.sm },
  dangerCard: { gap: SPACING.md },
});
