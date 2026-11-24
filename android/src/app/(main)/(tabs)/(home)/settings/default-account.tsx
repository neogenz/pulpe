import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Notice } from "@/core/ui/notice";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { SPACING } from "@/core/ui/theme";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { AccountChoiceList } from "@/features/net-worth/components/account-choice-list";
import { useAccountChoices } from "@/features/net-worth/use-account-selection";

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
        <AccountChoiceList
          choices={choices}
          value={defaultId}
          onChange={(defaultAccountId) =>
            update.mutate(
              { defaultAccountId },
              { onError: () => setFailed(true) },
            )
          }
        />
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
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
});
