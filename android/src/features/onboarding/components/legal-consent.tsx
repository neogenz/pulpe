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
export function LegalConsent({
  prefix,
  localized = false,
}: {
  prefix: string;
  localized?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = { color: theme.colors.onSurfaceVariant };
  const link = [styles.link, { color: theme.colors.primary }];
  const possessive = localized ? t("onboarding.legal.possessive") : "nos";
  const terms = localized
    ? t("onboarding.legal.terms")
    : "conditions générales";
  const possessiveSingular = localized
    ? t("onboarding.legal.possessiveSingular")
    : "notre";
  const privacy = localized
    ? t("onboarding.legal.privacy")
    : "politique de confidentialité";
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
        {localized ? t("common.and") : "et"} {possessiveSingular}{" "}
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
