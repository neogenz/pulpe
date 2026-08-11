import { Link } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Divider,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { authLoginSchema } from "pulpe-shared";

import {
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/core/auth/google-sign-in";
import { supabase } from "@/core/auth/supabase";
import { APP_URLS } from "@/core/ui/app-urls";
import { SPACING } from "@/core/ui/theme";

type Pending = "password" | "google" | null;

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  // The shared contract, not a second hand-rolled rule: a password the server
  // would accept must never be refused by the button in front of it.
  const isFormValid = authLoginSchema.safeParse({
    email: email.trim(),
    password,
  }).success;

  async function run(action: Pending, work: () => Promise<unknown>) {
    setPending(action);
    setErrorMessage(null);
    try {
      await work();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    } finally {
      setPending(null);
    }
  }

  async function submitPassword() {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
  }

  const isBusy = pending !== null;

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineMedium">Content de te revoir</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Connecte-toi pour accéder à ton budget
          </Text>
        </View>

        <TextInput
          mode="outlined"
          label="E-mail"
          placeholder="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          disabled={isBusy}
        />
        <TextInput
          mode="outlined"
          label="Mot de passe"
          placeholder="Ton mot de passe"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          disabled={isBusy}
        />

        <Link href="/forgot-password" asChild>
          <Button mode="text" compact disabled={isBusy}>
            Mot de passe oublié ?
          </Button>
        </Link>

        {errorMessage !== null && (
          <HelperText type="error" visible accessibilityLiveRegion="polite">
            {errorMessage}
          </HelperText>
        )}

        <Button
          mode="contained"
          loading={pending === "password"}
          disabled={isBusy || !isFormValid}
          onPress={() => void run("password", submitPassword)}
          accessibilityLabel={
            pending === "password" ? "Connexion en cours" : "Se connecter"
          }
        >
          Se connecter
        </Button>

        {isGoogleSignInAvailable && (
          <>
            <View style={styles.divider}>
              <Divider style={styles.dividerLine} />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                ou
              </Text>
              <Divider style={styles.dividerLine} />
            </View>

            <Button
              mode="outlined"
              icon="google"
              loading={pending === "google"}
              disabled={isBusy}
              onPress={() => void run("google", signInWithGoogle)}
            >
              {pending === "google"
                ? "Connexion en cours…"
                : "Continuer avec Google"}
            </Button>
          </>
        )}

        <View style={styles.legal}>
          <Button
            mode="text"
            compact
            onPress={() => void Linking.openURL(APP_URLS.terms)}
          >
            CGU
          </Button>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            et
          </Text>
          <Button
            mode="text"
            compact
            onPress={() => void Linking.openURL(APP_URLS.privacy)}
          >
            Politique de confidentialité
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: { gap: SPACING.xs, alignItems: "center" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dividerLine: { flex: 1 },
  legal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
});
