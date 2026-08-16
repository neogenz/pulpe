import { Link, useRouter } from "expo-router";
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
import { preferPitch } from "@/core/navigation/landing-preference";
import { APP_URLS } from "@/core/ui/app-urls";
import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { SCREEN_PADDING, SPACING } from "@/core/ui/theme";

type Pending = "password" | "google" | null;

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
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
      {/* The window does not shrink when the keyboard opens — the app is
          edge-to-edge, so the IME arrives as an inset the layout never sees.
          Padding the scroll content by that inset is what lets the centred
          form rise, and what keeps "Se connecter" reachable while typing. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_PADDING + keyboardHeight },
        ]}
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

        {/* testIDs, here and on the submit below, exist for the Maestro
            journeys: "Mot de passe" matches both this field and the "oublié ?"
            button, and a login test that taps the wrong one is worse than no
            login test. */}
        <TextInput
          testID="sign-in-email"
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
          testID="sign-in-password"
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
          testID="sign-in-submit"
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

        {/* The way back to the pitch. Without it this screen was a one-way
            door: a device that had already been through the flow could only
            ever sign in again, never create a second account. `replace` both
            ways keeps the two screens a single slot rather than a stack that
            grows on every toggle. */}
        <View style={styles.signUp}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Nouveau sur Pulpe ?
          </Text>
          <Button
            mode="text"
            compact
            disabled={isBusy}
            onPress={() => {
              preferPitch();
              router.replace("/(onboarding)");
            }}
          >
            Créer un compte
          </Button>
        </View>

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
    padding: SCREEN_PADDING,
    gap: SPACING.md,
  },
  header: { gap: SPACING.xs, alignItems: "center" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dividerLine: { flex: 1 },
  signUp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  legal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
});
