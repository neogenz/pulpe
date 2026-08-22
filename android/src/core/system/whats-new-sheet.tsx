import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  acknowledgeWhatsNew,
  canShowWhatsNew,
  checkWhatsNew,
  clearWhatsNewSession,
  useWhatsNewStore,
  whatsNewIdentity,
} from "./whats-new-store";

/**
 * What changed since the last version this device ran. Checked once the vault
 * is open, because the feed is authenticated and because a user still staring
 * at a PIN pad has not arrived yet.
 *
 * Mounted at app level: the check outlives whichever screen the unlock happens
 * to land on.
 */
export function WhatsNewSheet() {
  const { locale, t } = useTranslation();
  const isAuthenticated = useSessionStore(
    (state) => state.status === "authenticated",
  );
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");
  const whatsNew = useWhatsNewStore();
  const identity =
    isAuthenticated && isUnlocked && userId !== null
      ? whatsNewIdentity(userId, locale)
      : null;

  useEffect(() => {
    if (identity === null) {
      clearWhatsNewSession();
      return;
    }
    void checkWhatsNew(locale, identity);
  }, [identity, locale]);

  if (!canShowWhatsNew(whatsNew, identity)) return null;

  return (
    <Portal>
      <Dialog visible onDismiss={acknowledgeWhatsNew}>
        <Dialog.Icon icon="party-popper" />
        <Dialog.Title style={styles.centered}>
          {t("system.whatsNew.title")}
        </Dialog.Title>

        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            {whatsNew.entries.map((entry) => (
              <Release key={entry.version} {...entry} />
            ))}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button mode="contained" onPress={acknowledgeWhatsNew}>
            {t("system.whatsNew.acknowledge")}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function Release({ title, body }: { title: string; body: string }) {
  const theme = useTheme();

  return (
    <View style={styles.release}>
      <Text variant="titleSmall">{title}</Text>
      {/* The body arrives as one markdown block per release. Nothing here
          renders markdown, and pulling in a renderer for a bullet list would
          cost more than the asterisks it removes. */}
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {stripEmphasis(body)}
      </Text>
    </View>
  );
}

function stripEmphasis(body: string): string {
  return body.replaceAll("**", "");
}

const styles = StyleSheet.create({
  centered: { textAlign: "center" },
  content: { gap: SPACING.lg, paddingVertical: SPACING.md },
  release: { gap: SPACING.xs },
});
