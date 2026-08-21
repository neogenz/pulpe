import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { RADIUS, SPACING } from "@/core/ui/theme";

/** An illustration, not an icon — deliberately off the `ICON_SIZE` ladder. */
const ILLUSTRATION_SIZE = 40;

interface NotificationPrimeSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  onEnable: () => void;
}

/**
 * Asks before the system asks. Android remembers a refusal, so the OS prompt is
 * a one-shot in practice — this sheet spends the cheap "no" so the expensive one
 * is never spent cold.
 */
export function NotificationPrimeSheet({
  isVisible,
  onDismiss,
  onEnable,
}: NotificationPrimeSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View accessibilityViewIsModal style={styles.content}>
          <MaterialCommunityIcons
            name="bell-badge-outline"
            size={ILLUSTRATION_SIZE}
            color={theme.colors.primary}
            accessible={false}
          />
          <Text variant="headlineSmall" style={styles.centered}>
            {t("home.reminderPrime.title")}
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("home.reminderPrime.body")}
          </Text>

          <View style={styles.actions}>
            <Button mode="contained" onPress={onEnable}>
              {t("home.reminderPrime.enable")}
            </Button>
            <Button mode="text" onPress={onDismiss}>
              {t("home.reminderPrime.later")}
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: SPACING.md, borderRadius: RADIUS.md },
  content: {
    padding: SPACING.xl,
    gap: SPACING.md,
    alignItems: "center",
  },
  centered: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: SPACING.xs, marginTop: SPACING.md },
});
