import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { SPACING } from "@/core/ui/theme";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  acknowledgeWhatsNew,
  checkWhatsNew,
  useWhatsNewStore,
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
  const isAuthenticated = useSessionStore(
    (state) => state.status === "authenticated",
  );
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");
  const entries = useWhatsNewStore((state) => state.entries);

  useEffect(() => {
    if (!isAuthenticated || !isUnlocked) return;
    void checkWhatsNew();
  }, [isAuthenticated, isUnlocked]);

  if (entries.length === 0) return null;

  return (
    <Portal>
      <Dialog visible onDismiss={acknowledgeWhatsNew}>
        <Dialog.Icon icon="party-popper" />
        <Dialog.Title style={styles.centered}>Quoi de neuf</Dialog.Title>

        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            {entries.map((entry) => (
              <Release key={entry.version} {...entry} />
            ))}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button mode="contained" onPress={acknowledgeWhatsNew}>
            J&apos;ai vu
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
