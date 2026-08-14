import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Divider,
  HelperText,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/core/auth/google-sign-in";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";

import { LegalConsent } from "../components/legal-consent";
import { beginOnboarding, configureSocialUser } from "../onboarding-store";

const BRAND_MARK_SIZE = 88;

const BENEFITS = [
  { icon: "format-list-bulleted", text: "Un plan clair pour chaque mois" },
  { icon: "check-circle-outline", text: "Tes dépenses pointées en un geste" },
  { icon: "lock-outline", text: "Chiffré — tes montants restent privés" },
] as const;

/**
 * The pitch, and the fork between the two signup paths. Google is offered
 * first because it is one tap and skips two questions; e-mail is the path that
 * always works. Both land in the same flow.
 */
export function WelcomeStep() {
  const theme = useTheme();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function continueWithGoogle() {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const result = await signInWithGoogle();
      if (result === null) return;
      configureSocialUser(result.firstName);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Connexion Google impossible — réessaie.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require("../../../../assets/images/brand-mark.png")}
            style={styles.brandMark}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text variant="headlineLarge" style={styles.headline}>
            Vois clair dans tes finances
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.headline, { color: theme.colors.onSurfaceVariant }]}
          >
            Ton budget est prêt en 2 minutes
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.text} style={styles.benefitRow}>
              <MaterialCommunityIcons
                name={benefit.icon}
                size={ICON_SIZE.lg}
                color={theme.colors.primary}
              />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {benefit.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {errorMessage !== null && (
          <HelperText type="error" visible accessibilityLiveRegion="polite">
            {errorMessage}
          </HelperText>
        )}

        {isGoogleSignInAvailable && (
          <>
            <Button
              mode="contained"
              icon="google"
              loading={isSigningIn}
              disabled={isSigningIn}
              onPress={() => void continueWithGoogle()}
            >
              Continuer avec Google
            </Button>
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
          </>
        )}

        <Button
          mode={isGoogleSignInAvailable ? "outlined" : "contained"}
          disabled={isSigningIn}
          onPress={beginOnboarding}
        >
          S&apos;inscrire avec un e-mail
        </Button>

        <Button
          mode="text"
          disabled={isSigningIn}
          onPress={() => router.replace("/sign-in")}
        >
          J&apos;ai déjà un compte
        </Button>

        <LegalConsent prefix="En continuant, tu acceptes" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.xxl,
  },
  hero: { alignItems: "center", gap: SPACING.md },
  brandMark: { width: BRAND_MARK_SIZE, height: BRAND_MARK_SIZE },
  headline: { textAlign: "center" },
  benefits: { gap: SPACING.md },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  actions: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.sm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dividerLine: { flex: 1 },
});
