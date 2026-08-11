import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import {
  isAcceptablePassword,
  PASSWORD_CRITERIA,
} from "@/core/auth/password-rules";
import { updatePassword, verifyPassword } from "@/core/auth/supabase";
import { RADIUS, SPACING } from "@/core/ui/theme";

const CRITERION_ICON_SIZE = 16;

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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    } catch (error) {
      setErrorMessage(describeFailure(error));
    } finally {
      setSubmitting(false);
    }
  }

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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="titleMedium">Changer le mot de passe</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Confirme ton identité pour modifier ton accès.
          </Text>

          <TextInput
            mode="outlined"
            label="Mot de passe actuel"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />

          <TextInput
            mode="outlined"
            label="Nouveau mot de passe"
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
                <View key={criterion.label} style={styles.criterion}>
                  <MaterialCommunityIcons
                    name={isMet ? "check-circle" : "circle-outline"}
                    size={CRITERION_ICON_SIZE}
                    color={color}
                  />
                  <Text variant="labelMedium" style={{ color }}>
                    {criterion.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <TextInput
            mode="outlined"
            label="Confirme le nouveau mot de passe"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={confirmation.length > 0 && !isConfirmed}
          />
          {confirmation.length > 0 && !isConfirmed && (
            <HelperText type="error" visible>
              Les mots de passe ne correspondent pas.
            </HelperText>
          )}

          {errorMessage !== null && (
            <HelperText type="error" visible>
              {errorMessage}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={!isSubmittable}
            loading={isSubmitting}
          >
            Confirmer
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isSubmitting}>
            Annuler
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

/** The one failure worth naming: the rest reads better in Supabase's words. */
function describeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Mot de passe actuel incorrect.";
  }
  return message.length > 0
    ? message
    : "Le mot de passe n'a pas pu être modifié.";
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  criteria: { gap: SPACING.xxs },
  criterion: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
