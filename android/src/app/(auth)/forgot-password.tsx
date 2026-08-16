import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { z } from "zod";

import { PASSWORD_RESET_REDIRECT_URL, supabase } from "@/core/auth/supabase";
import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { SCREEN_PADDING, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

const emailSchema = z.email();

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function send() {
    setIsSending(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
    });
    setIsSending(false);

    // Deliberately not surfaced per address: a per-address failure would tell
    // an attacker which e-mails have an account here.
    if (error && error.status !== undefined && error.status >= 500) {
      setErrorMessage("Quelque chose n'a pas fonctionné — réessaie.");
      return;
    }
    setIsSent(true);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.Content title="Mot de passe oublié" />
        <Appbar.Action
          icon="close"
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
        />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_PADDING + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {isSent ? (
          <SentConfirmation onClose={() => router.back()} />
        ) : (
          <>
            <Text variant="bodyMedium">
              Entre ton email pour recevoir un lien de réinitialisation.
            </Text>

            <TextInput
              mode="outlined"
              label="Adresse e-mail"
              placeholder="ton@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              disabled={isSending}
            />

            {errorMessage !== null && (
              <FieldError visible>{errorMessage}</FieldError>
            )}

            <Button
              mode="contained"
              loading={isSending}
              disabled={
                isSending || !emailSchema.safeParse(email.trim()).success
              }
              onPress={() => void send()}
              accessibilityLabel={isSending ? "Envoi en cours" : undefined}
            >
              Envoyer le lien
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Neutral on purpose, mirroring `ForgotPasswordSheet`: confirming that an
 * address has no account would turn this screen into an account enumerator.
 */
function SentConfirmation({ onClose }: { onClose: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.confirmation}>
      <Text variant="titleLarge">Email envoyé</Text>
      <Text variant="bodyMedium">
        Si un compte existe avec cette adresse, tu recevras un email avec un
        lien de réinitialisation.
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Pense à vérifier tes spams si tu ne le vois pas.
      </Text>
      <Button mode="contained" onPress={onClose}>
        Retour à la connexion
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SCREEN_PADDING, gap: SPACING.md },
  confirmation: { gap: SPACING.md },
});
