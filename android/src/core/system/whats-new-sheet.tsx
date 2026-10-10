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

export function Release({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <View style={styles.release}>
      <Text variant="titleSmall">{title}</Text>
      {/* The body arrives as one markdown block per release, a `- ` line per
          note. Only that bullet syntax and the `**` emphasis occur, so they are
          read here rather than through a markdown renderer. */}
      {body
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, index) => {
          const isItem = line.startsWith("- ");
          const text = (isItem ? line.slice(2) : line).replaceAll("**", "");
          return (
            <View key={index} style={styles.item}>
              {isItem && (
                <Text
                  variant="bodyMedium"
                  style={muted}
                  importantForAccessibility="no"
                >
                  •
                </Text>
              )}
              <Text variant="bodyMedium" style={[muted, styles.itemText]}>
                {text}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: "center" },
  content: { gap: SPACING.lg, paddingVertical: SPACING.md },
  release: { gap: SPACING.xs },
  item: { flexDirection: "row", gap: SPACING.sm },
  itemText: { flex: 1 },
});
