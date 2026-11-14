import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { FormModal } from "@/core/ui/sheet";
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
import { CURRENT_APP_VERSION } from "./system-store";

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
    <FormModal
      isVisible
      onDismiss={acknowledgeWhatsNew}
      title={t("system.whatsNew.title")}
      subtitle={t("system.whatsNew.version", { version: CURRENT_APP_VERSION })}
      footer={
        <Button mode="contained" onPress={acknowledgeWhatsNew}>
          {t("system.whatsNew.acknowledge")}
        </Button>
      }
    >
      {whatsNew.entries.map((entry) => (
        <Release
          key={entry.version}
          version={entry.version}
          body={entry.body}
          showVersion={whatsNew.entries.length > 1}
        />
      ))}
    </FormModal>
  );
}

interface ReleaseProps {
  version: string;
  body: string;
  /** Only an aggregate of several skipped versions needs to say which is which. */
  showVersion: boolean;
}

/**
 * The body arrives as one markdown block per release, a
 * `- **Title** — detail` line per note. Only that shape occurs, so it is read
 * here rather than through a markdown renderer.
 */
export function Release({ version, body, showVersion }: ReleaseProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.release}>
      {showVersion && (
        <Text variant="labelLarge">
          {t("system.whatsNew.version", { version })}
        </Text>
      )}
      {body
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, index) => {
          const { title, detail } = parseNote(line);
          return (
            <View key={index} style={styles.note}>
              {title !== undefined && (
                <Text variant="titleMedium">{title}</Text>
              )}
              <Text
                variant="bodyMedium"
                style={{
                  color:
                    title === undefined
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                }}
              >
                {detail}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

export function parseNote(line: string): { title?: string; detail: string } {
  const content = line.trim().replace(/^- /, "");
  const match = /^\*\*(.+?)\*\*\s*(?:[—-]\s*)?(.*)$/.exec(content);
  if (match === null) return { detail: content.replaceAll("**", "") };
  return { title: match[1], detail: match[2].replaceAll("**", "") };
}

const styles = StyleSheet.create({
  release: { gap: SPACING.md },
  note: { gap: SPACING.xxs },
});
