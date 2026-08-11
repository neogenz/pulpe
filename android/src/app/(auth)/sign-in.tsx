import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { supabase } from "@/core/auth/supabase";
import { SPACING } from "@/core/ui/theme";

/**
 * Minimal sign-in, enough to exercise session persistence and the route guards.
 * The real flow — Google, biometrics, demo mode, the vault — lands in phase 3.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setErrorMessage(error.message);
    setIsSubmitting(false);
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Text variant="headlineMedium">Content de te revoir</Text>

      <TextInput
        mode="outlined"
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextInput
        mode="outlined"
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
      />

      {errorMessage ? (
        <HelperText type="error" visible>
          {errorMessage}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        loading={isSubmitting}
        disabled={isSubmitting || email.length === 0 || password.length === 0}
        onPress={() => void submit()}
      >
        Se connecter
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
});
