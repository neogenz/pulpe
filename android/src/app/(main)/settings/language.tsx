import { router } from "expo-router";
import {
  ANALYTICS_EVENTS,
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  supportedLocaleSchema,
  type SupportedLocale,
} from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Appbar, RadioButton, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  setLocale,
  setLocaleWritePending,
  useTranslation,
} from "@/core/i18n/locale-store";
import { createLanguageWriter } from "@/core/i18n/language-writer";
import { captureEvent } from "@/core/observability/analytics";
import { Notice } from "@/core/ui/notice";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { SettingsSection } from "@/features/account/components/settings-section";

export default function LanguageScreen() {
  const theme = useTheme();
  const settings = useUserSettings();
  const update = useUpdateUserSettings();
  const { locale, t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const [writer] = useState(() =>
    createLanguageWriter(settings.data?.locale ?? locale, {
      apply: setLocale,
      persist: (next) => update.mutateAsync({ locale: next }),
      setPending: setLocaleWritePending,
      onConfirmed: (from, to) =>
        captureEvent(ANALYTICS_EVENTS.LANGUAGE_CHANGED, {
          from,
          to,
          surface: "settings",
        }),
      onLatestError: () => setHasError(true),
    }),
  );

  function choose(value: string) {
    const next: SupportedLocale = supportedLocaleSchema.parse(value);
    void writer.choose(next);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.language.title")} />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title={t("settings.language.title")}>
          <RadioButton.Group value={locale} onValueChange={choose}>
            {SUPPORTED_LOCALES.map((candidate) => (
              <RadioButton.Item
                key={candidate}
                value={candidate}
                label={LOCALE_METADATA[candidate].nativeName}
                accessibilityLabel={LOCALE_METADATA[candidate].nativeName}
              />
            ))}
          </RadioButton.Group>
        </SettingsSection>
      </ScrollView>

      <Notice visible={hasError} onDismiss={() => setHasError(false)}>
        {t("settings.language.saveError")}
      </Notice>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md },
});
