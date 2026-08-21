import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticSuccess } from "@/core/ui/haptics";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";
import { formatRecoveryKey } from "@/core/vault/recovery-key";
import {
  acknowledgeRecoveryNotice,
  useVaultStore,
} from "@/core/vault/vault-store";

const COPIED_RESET_MS = 2000;

/**
 * The recovery key, shown once and never retrievable again — hence no dismiss
 * gesture: leaving by accident costs the user the only way back into their own
 * data if they forget their PIN.
 *
 * Mounted at app level rather than by the screen that minted the key, because
 * minting is the same moment the vault unlocks and the router drops that
 * screen out of the navigator.
 */
export function RecoveryKeyNotice() {
  const notice = useVaultStore((state) => state.pendingRecoveryNotice);
  if (notice === null) return null;

  return notice.kind === "minted" ? (
    <MintedKeyDialog recoveryKey={notice.recoveryKey} />
  ) : (
    <MintFailedDialog />
  );
}

function MintedKeyDialog({ recoveryKey }: { recoveryKey: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    },
    [],
  );

  async function copy() {
    await Clipboard.setStringAsync(recoveryKey);
    hapticSuccess();
    setIsCopied(true);

    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(
      () => setIsCopied(false),
      COPIED_RESET_MS,
    );
  }

  return (
    <Portal>
      <Dialog visible dismissable={false} onDismiss={acknowledgeRecoveryNotice}>
        <Dialog.Icon icon="key-variant" />
        <Dialog.Title style={styles.centered}>
          {t("vault.recovery.title")}
        </Dialog.Title>

        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.centered}>
              {t("vault.notice.mintedBody")}
            </Text>

            <View
              style={[
                styles.keyCard,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Text variant="bodyMedium" selectable style={styles.key}>
                {formatRecoveryKey(recoveryKey)}
              </Text>
            </View>

            <Button
              mode="contained-tonal"
              icon={isCopied ? "check" : "content-copy"}
              onPress={() => void copy()}
              accessibilityLabel={
                isCopied
                  ? t("vault.notice.copiedA11y")
                  : t("vault.notice.copyA11y")
              }
            >
              {t(isCopied ? "vault.notice.copied" : "vault.notice.copy")}
            </Button>

            <View
              style={[
                styles.warning,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="alert"
                size={ICON_SIZE.md}
                color={theme.colors.onErrorContainer}
              />
              <Text
                variant="bodySmall"
                style={[
                  styles.warningText,
                  { color: theme.colors.onErrorContainer },
                ]}
              >
                {t("vault.notice.warning")}
              </Text>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button mode="contained" onPress={acknowledgeRecoveryNotice}>
            {t("vault.notice.acknowledge")}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/**
 * The vault was rewrapped but the replacement key never arrived. Access is
 * intact, so this is a warning with a way forward, not a failure.
 */
function MintFailedDialog() {
  const { t } = useTranslation();
  return (
    <Portal>
      <Dialog visible dismissable={false} onDismiss={acknowledgeRecoveryNotice}>
        <Dialog.Icon icon="key-alert-outline" />
        <Dialog.Title style={styles.centered}>
          {t("vault.recovery.title")}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{t("vault.notice.mintFailedBody")}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button mode="contained" onPress={acknowledgeRecoveryNotice}>
            {t("vault.notice.understood")}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: "center" },
  content: { gap: SPACING.md, paddingVertical: SPACING.md },
  keyCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  key: {
    fontFamily: "monospace",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  warningText: { flex: 1 },
});
