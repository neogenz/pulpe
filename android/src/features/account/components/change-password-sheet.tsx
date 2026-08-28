import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";

import {
  isAcceptablePassword,
  PASSWORD_CRITERIA,
  PASSWORD_MIN_LENGTH,
} from "@/core/auth/password-rules";
import { isInvalidCredentials } from "@/core/auth/auth-error";
import { useTranslation } from "@/core/i18n/locale-store";
import { hapticSuccess } from "@/core/ui/haptics";
import { updatePassword, verifyPassword } from "@/core/auth/supabase";
import { FormModal } from "@/core/ui/sheet";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

/**
 * Changing the password asks for the current one first — Supabase would let an
 * open session change it without proof, and a borrowed unlocked phone is
 * exactly the case that matters. Mirrors `ChangePasswordSheet` on iOS.
 */
export function ChangePasswordSheet({
  isVisible,
  onDismiss,
  email,
  onChanged,
}: {
  isVisible: boolean;
  onDismiss: () => void;
  email: string;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const isConfirmed = newPassword.length > 0 && newPassword === confirmation;
  const isSubmittable =
    currentPassword.length > 0 &&
    isAcceptablePassword(newPassword) &&
    isConfirmed &&
    !isSubmitting;

  async function submit() {
    if (!isSubmittable) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await verifyPassword(email, currentPassword);
      await updatePassword(newPassword);
      hapticSuccess();
      onChanged();
    } catch (error) {
      setErrorMessage(
        t(
          isInvalidCredentials(error)
            ? "settings.security.changePasswordCurrentIncorrect"
            : "settings.security.changePasswordError",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={isSubmitting}
      title={t("settings.security.changePasswordTitle")}
      subtitle={t("settings.security.changePasswordSubtitle")}
      footer={
        <>
          {errorMessage !== null && (
            <FieldError visible>{errorMessage}</FieldError>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={!isSubmittable}
            loading={isSubmitting}
          >
            {t("settings.security.changePasswordAction")}
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label={t("settings.security.changePasswordCurrent")}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
      />

      <TextInput
        mode="outlined"
        label={t("settings.security.changePasswordNew")}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />

      <View style={styles.criteria}>
        {PASSWORD_CRITERIA.map((criterion) => {
          const isMet = criterion.isMet(newPassword);
          const color = isMet
            ? theme.colors.primary
            : theme.colors.onSurfaceVariant;

          return (
            <View key={criterion.key} style={styles.criterion}>
              <MaterialCommunityIcons
                name={isMet ? "check-circle" : "circle-outline"}
                size={ICON_SIZE.sm}
                color={color}
              />
              <Text variant="labelMedium" style={{ color }}>
                {t(`onboarding.registration.criteria.${criterion.key}`, {
                  count: PASSWORD_MIN_LENGTH,
                })}
              </Text>
            </View>
          );
        })}
      </View>

      <TextInput
        mode="outlined"
        label={t("settings.security.changePasswordConfirm")}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={confirmation.length > 0 && !isConfirmed}
      />
      {confirmation.length > 0 && !isConfirmed && (
        <FieldError visible>{t("auth.reset.mismatch")}</FieldError>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  criteria: { gap: SPACING.xxs },
  criterion: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
