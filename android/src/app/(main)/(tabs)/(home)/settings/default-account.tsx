import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, RadioButton, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { Notice } from "@/core/ui/notice";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SPACING } from "@/core/ui/theme";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { SettingsSection } from "@/features/account/components/settings-section";
import { useAccountChoices } from "@/features/net-worth/use-account-selection";

const NONE = "none";

/**
 * The element new movements start on, as `AccountPickerField` in the iOS
 * Préférences: « Aucun », then what I have, then what I owe (CA28).
 */
export default function DefaultAccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { choices, defaultId } = useAccountChoices();
  const update = useUpdateUserSettings();
  const [hasFailed, setFailed] = useState(false);

  function choose(value: string) {
    update.mutate(
      { defaultAccountId: value === NONE ? null : value },
      { onError: () => setFailed(true) },
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenAppBar>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={t("netWorth.account.defaultLabel")} />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <RadioButton.Group value={defaultId ?? NONE} onValueChange={choose}>
          <View style={styles.groups}>
            <Card mode="contained">
              <RadioButton.Item
                value={NONE}
                label={t("netWorth.account.none")}
                accessibilityLabel={t("netWorth.account.none")}
              />
            </Card>
            {[
              { key: "own", title: t("netWorth.have"), assets: choices.own },
              { key: "owe", title: t("netWorth.owe"), assets: choices.owe },
            ]
              .filter((group) => group.assets.length > 0)
              .map((group) => (
                <SettingsSection key={group.key} title={group.title}>
                  {group.assets.map((asset) => (
                    <RadioButton.Item
                      key={asset.id}
                      value={asset.id}
                      label={asset.name}
                      accessibilityLabel={asset.name}
                    />
                  ))}
                </SettingsSection>
              ))}
          </View>
        </RadioButton.Group>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("netWorth.account.defaultHint")}
        </Text>
      </ScrollView>

      <Notice visible={hasFailed} onDismiss={() => setFailed(false)}>
        {t("netWorth.saveError")}
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  groups: { gap: SPACING.lg },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
});
