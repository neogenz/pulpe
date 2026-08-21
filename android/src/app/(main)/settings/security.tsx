import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  Portal,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { Eyebrow } from "@/core/ui/eyebrow";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useSessionStore } from "@/core/auth/session-store";
import { describeBiometrics } from "@/core/crypto/biometrics";
import { useTranslation } from "@/core/i18n/locale-store";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { Notice } from "@/core/ui/notice";
import { AUTO_LOCK_DELAY_MINUTES } from "@/core/vault/auto-lock";
import {
  disableVaultBiometrics,
  enableVaultBiometrics,
  lockVault,
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
  const { t } = useTranslation();
  // `theme.colors.error` is the app's amber, deliberately: a form error is not a
  // punishment. Deleting an account is the other thing, so it wears the red the
  // palette keeps for what cannot be undone.
  const danger = useFinancialColors();
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
    queryKey: ["biometrics", "kind"],
    queryFn: describeBiometrics,
    staleTime: Infinity,
  });
  const biometricKind = biometrics.data ?? null;
  const biometricLabel =
    biometricKind === null
      ? null
      : t(`settings.security.biometric.${biometricKind}`);
  const email = profile.data?.email ?? sessionEmail ?? "";

  async function enableBiometrics() {
    setBiometricBusy(true);
    try {
      const isEnabled = await enableVaultBiometrics();
      setNotice(
        isEnabled
          ? t("settings.security.biometricEnabled", {
              label: biometricLabel ?? t("settings.security.biometric.generic"),
            })
          : t("settings.security.biometricEnableError"),
      );
    } catch {
      setNotice(t("settings.security.biometricEnableError"));
    } finally {
      setBiometricBusy(false);
    }
  }

  async function disableBiometrics() {
    setBiometricBusy(true);
    try {
      await disableVaultBiometrics();
      setNotice(
        t("settings.security.biometricDisabled", {
          label: biometricLabel ?? t("settings.security.biometric.generic"),
        }),
      );
    } catch {
      setNotice(t("settings.security.biometricDisableError"));
    } finally {
      setBiometricBusy(false);
      setDisablingBiometrics(false);
    }
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.security.title")} />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title={t("settings.security.accessSection")}>
          <SettingsRow
            icon="dialpad"
            title={t("settings.security.pinTitle")}
            description={t("settings.security.pinDescription")}
            onPress={() => router.push("/settings/change-pin")}
          />
          <SettingsRow
            icon="lock-outline"
            title={t("common.password")}
            description={t("settings.security.passwordDescription")}
            isDisabled={email.length === 0}
            onPress={() => setSheet("password")}
          />
          {/* The vault closes on its own after a spell in the background; this
              is for the moment the user knows they are handing the phone over
              and does not want to wait it out. */}
          <SettingsRow
            icon="lock-clock"
            title={t("settings.security.lockTitle")}
            description={t("settings.security.lockDescription", {
              count: AUTO_LOCK_DELAY_MINUTES,
            })}
            onPress={() => void lockVault()}
          />
        </SettingsSection>

        <SettingsSection title="Clé de récupération">
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
          <SettingsSection title={t("settings.security.biometricSection")}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">{biometricLabel}</Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.security.biometricDescription")}
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
          <Eyebrow style={{ color: danger.destructive }}>
            Zone de danger
          </Eyebrow>
          <Card
            mode="contained"
            style={{ backgroundColor: danger.destructiveContainer }}
          >
            <Card.Content style={styles.dangerCard}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface }}
              >
                Supprimer ton compte efface définitivement tes budgets, tes
                objectifs et tes opérations après un délai de grâce.
              </Text>
              <Button
                mode="contained"
                buttonColor={danger.destructive}
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
            setNotice(t("settings.security.passwordChanged"));
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
          onDismiss={() => {
            if (!isBiometricBusy) setDisablingBiometrics(false);
          }}
        >
          <Dialog.Title>
            {t("settings.security.biometricDisableTitle", {
              label: biometricLabel,
            })}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.security.biometricDisableDescription")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setDisablingBiometrics(false)}
              disabled={isBiometricBusy}
            >
              {t("common.cancel")}
            </Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => void disableBiometrics()}
              disabled={isBiometricBusy}
            >
              {t("settings.security.biometricDisableAction")}
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
              textColor={danger.destructive}
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

      <Notice visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Notice>
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
