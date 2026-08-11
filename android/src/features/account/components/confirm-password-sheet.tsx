import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  Button,
  HelperText,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { verifyPassword } from "@/core/auth/supabase";
import { RADIUS, SPACING } from "@/core/ui/theme";

/**
 * Stands between an unlocked session and an act only the account holder should
 * be able to perform. Minting a new recovery key invalidates the written-down
 * one, so an unattended phone must not be enough to do it.
 */
export function ConfirmPasswordSheet({
  isVisible,
  onDismiss,
  email,
  title,
  message,
  onConfirmed,
}: {
  isVisible: boolean;
  onDismiss: () => void;
  email: string;
  title: string;
  message: string;
  /** Runs once the password checks out; its failure is shown here. */
  onConfirmed: () => Promise<void>;
}) {
  const theme = useTheme();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit() {
    if (password.length === 0 || isSubmitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await verifyPassword(email, password);
      await onConfirmed();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setErrorMessage(
        raw.toLowerCase().includes("invalid login credentials")
          ? "Mot de passe incorrect."
          : raw || "L'opération a échoué. Réessaie.",
      );
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
          <Text variant="titleMedium">{title}</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {message}
          </Text>

          <TextInput
            mode="outlined"
            label="Ton mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            autoFocus
          />

          {errorMessage !== null && (
            <HelperText type="error" visible>
              {errorMessage}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={() => void submit()}
            disabled={password.length === 0 || isSubmitting}
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

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
});
