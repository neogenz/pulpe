import { Linking, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { APP_URLS } from "@/core/ui/app-urls";
import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";

/**
 * Consent is implicit and stated where the commitment is made, rather than
 * behind a checkbox nobody reads — same wording and same placement as the iOS
 * welcome and registration steps.
 */
export function LegalConsent({ prefix }: { prefix: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const link = [styles.link, { color: theme.colors.primary }];
  const possessive = t("onboarding.legal.possessive");
  const terms = t("onboarding.legal.terms");
  const possessiveSingular = t("onboarding.legal.possessiveSingular");
  const privacy = t("onboarding.legal.privacy");
  return (
    <View style={styles.paragraph}>
      <Text variant="bodySmall" style={muted}>
        {prefix} {possessive}{" "}
        <Text
          variant="bodySmall"
          style={link}
          onPress={() => void Linking.openURL(APP_URLS.terms)}
          accessibilityRole="link"
        >
          {terms}
        </Text>{" "}
        {t("common.and")} {possessiveSingular}{" "}
        <Text
          variant="bodySmall"
          style={link}
          onPress={() => void Linking.openURL(APP_URLS.privacy)}
          accessibilityRole="link"
        >
          {privacy}
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paragraph: { paddingHorizontal: SPACING.xs },
  link: { textDecorationLine: "underline" },
});
