import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";

import {
  isAcceptablePassword,
  PASSWORD_CRITERIA,
  PASSWORD_MIN_LENGTH,
} from "@/core/auth/password-rules";
import { signUpWithEmail } from "@/core/auth/sign-up";
import { useTranslation } from "@/core/i18n/locale-store";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

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

const CRITERIA_KEYS = ["minimum", "letter", "number"] as const;

/**
 * Where the account is created. Everything answered before this point lives in
 * the draft; everything after it needs a session, which is why the flow can
 * neither start here nor skip it.
 */
export function RegistrationStep({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
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
    } catch {
      setErrorMessage(t("onboarding.registration.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StepScaffold
      ctaLabel={t("onboarding.registration.submit")}
      title={t("onboarding.registration.title")}
      subtitle={t("onboarding.registration.subtitle")}
      isCtaEnabled={isEmailValid && isAcceptablePassword(password)}
      isCtaBusy={isSubmitting}
      onContinue={() => void submit()}
      onExit={onExit}
    >
      <TextInput
        mode="outlined"
        label={t("common.email")}
        placeholder={t("common.emailExample")}
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
          label={t("common.password")}
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
                  ? t("auth.signIn.hidePassword")
                  : t("auth.signIn.showPassword")
              }
            />
          }
        />

        <View style={styles.criteria}>
          {PASSWORD_CRITERIA.map((criterion, index) => {
            const isMet = criterion.isMet(password);
            const key = CRITERIA_KEYS[index]!;
            const label = t(`onboarding.registration.criteria.${key}`, {
              count: PASSWORD_MIN_LENGTH,
            });
            const status = t(
              `onboarding.registration.${isMet ? "met" : "missing"}`,
            );
            const accessibilityLabel = t("onboarding.registration.criterion", {
              label,
              status,
            });
            return (
              <View key={key} style={styles.criterion}>
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
                  accessibilityLabel={accessibilityLabel}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {errorMessage !== null && <FieldError visible>{errorMessage}</FieldError>}

      <LegalConsent localized prefix={t("onboarding.registration.legal")} />
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
