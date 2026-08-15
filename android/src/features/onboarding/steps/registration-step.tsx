import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { HelperText, Text, TextInput, useTheme } from "react-native-paper";

import {
  isAcceptablePassword,
  PASSWORD_CRITERIA,
} from "@/core/auth/password-rules";
import { signUpWithEmail } from "@/core/auth/sign-up";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";

import { LegalConsent } from "../components/legal-consent";
import { StepScaffold } from "../components/step-scaffold";
import { captureSignupCompleted } from "../onboarding-analytics";
import { hasAccount } from "../onboarding-selectors";
import {
  configureEmailUser,
  goToNextStep,
  setEmail,
  useOnboardingStore,
} from "../onboarding-store";

/**
 * Where the account is created. Everything answered before this point lives in
 * the draft; everything after it needs a session, which is why the flow can
 * neither start here nor skip it.
 */
export function RegistrationStep({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const email = useOnboardingStore((state) => state.email);
  const firstName = useOnboardingStore((state) => state.firstName);
  const isAlreadyRegistered = useOnboardingStore(hasAccount);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit() {
    // A cold start can land back here on an account that already exists, and
    // signing up again on the same address would fail on a user who is in fact
    // already registered.
    if (isAlreadyRegistered) {
      goToNextStep();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signUpWithEmail(email.trim(), password, firstName);
      captureSignupCompleted("email");
      configureEmailUser();
      goToNextStep();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Création du compte impossible — réessaie.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StepScaffold
      ctaLabel="Créer mon compte"
      isCtaEnabled={isEmailValid && isAcceptablePassword(password)}
      isCtaBusy={isSubmitting}
      onContinue={() => void submit()}
      onExit={onExit}
    >
      <TextInput
        mode="outlined"
        label="E-mail"
        placeholder="ton@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        disabled={isSubmitting}
      />

      <View style={styles.passwordBlock}>
        <TextInput
          mode="outlined"
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry={!isPasswordVisible}
          disabled={isSubmitting}
          right={
            <TextInput.Icon
              icon={isPasswordVisible ? "eye-off" : "eye"}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              accessibilityLabel={
                isPasswordVisible
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
            />
          }
        />

        <View style={styles.criteria}>
          {PASSWORD_CRITERIA.map((criterion) => {
            const isMet = criterion.isMet(password);
            return (
              <View key={criterion.label} style={styles.criterion}>
                <MaterialCommunityIcons
                  name={isMet ? "check-circle" : "circle-outline"}
                  size={ICON_SIZE.sm}
                  color={
                    isMet ? theme.colors.primary : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: isMet
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                  }}
                  accessibilityLabel={`${criterion.label} — ${isMet ? "rempli" : "à remplir"}`}
                >
                  {criterion.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {errorMessage !== null && (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {errorMessage}
        </HelperText>
      )}

      <LegalConsent prefix="En créant ton compte, tu acceptes" />
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  passwordBlock: { gap: SPACING.sm },
  criteria: { gap: SPACING.xs, paddingHorizontal: SPACING.xs },
  criterion: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
});
