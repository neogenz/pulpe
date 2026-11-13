import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/core/auth/google-sign-in";
import { preferSignIn } from "@/core/navigation/landing-preference";
import { useTranslation } from "@/core/i18n/locale-store";
import {
  captureLoginCompleted,
  captureLoginFailed,
  captureSignupStarted,
} from "@/core/observability/product-events";
import { formatMonthName } from "@/core/ui/date-format";
import { formatCurrency } from "@/core/ui/amount-format";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING, TINT_ALPHA } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import { captureWelcomeViewed } from "../onboarding-analytics";
import { LegalConsent } from "../components/legal-consent";
import { OnboardingBudgetRing } from "../components/onboarding-budget-ring";
import { beginOnboarding, configureSocialUser } from "../onboarding-store";

/** A sample month whose stickers add up to the ring's centre: a budget app's first figures must check out. */
const SAMPLE = { income: 6200, charges: 3021.5, savings: 588 } as const;
const STICKER_TILT = 4;

/**
 * The pitch, and the fork between the two signup paths. Google is offered
 * first because it is one tap and skips two questions; e-mail is the path that
 * always works. Both land in the same flow.
 */
export function WelcomeStep() {
  const theme = useTheme();
  const router = useRouter();
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();
  const shouldReduceMotion = useReducedMotion();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const now = new Date();

  useEffect(() => captureWelcomeViewed(), []);

  async function continueWithGoogle() {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      captureSignupStarted("google");
      const result = await signInWithGoogle();
      if (result === null) return;
      captureLoginCompleted("google");
      // The vault bootstrap decides whether this is a signup or a returning
      // account. Until then, keep only the provider data needed by either path.
      configureSocialUser(result.firstName);
    } catch (error) {
      captureLoginFailed("google", error);
      setErrorMessage(t("onboarding.welcome.googleError"));
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInDown.delay(100)}
          style={styles.illustration}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <OnboardingBudgetRing
            {...SAMPLE}
            currency="CHF"
            subtitle={`CHF · ${formatMonthName(now.getMonth() + 1, now.getFullYear(), locale)}`}
          />
          <Sticker
            style={[styles.stickerTop, tilt(-STICKER_TILT)]}
            tint={financial.expense}
            label={t("onboarding.welcome.stickers.charges")}
            amount={formatCurrency(SAMPLE.charges, "CHF")}
          />
          <Sticker
            style={[styles.stickerBottomEnd, tilt(STICKER_TILT)]}
            tint={financial.savings}
            label={t("onboarding.welcome.stickers.savings")}
            amount={formatCurrency(SAMPLE.savings, "CHF")}
          />
          <Sticker
            style={[styles.stickerBottomStart, tilt(-STICKER_TILT)]}
            tint={financial.income}
            label={t("onboarding.welcome.stickers.salary")}
            amount={`+${formatCurrency(SAMPLE.income, "CHF")}`}
          />
        </Animated.View>

        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInDown.delay(250)}
          style={styles.headlines}
        >
          <Text variant="headlineLarge" accessibilityRole="header">
            {t("onboarding.welcome.title")}
          </Text>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("onboarding.welcome.subtitle")}
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={styles.actions}>
        {errorMessage !== null && (
          <FieldError visible>{errorMessage}</FieldError>
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
              {t("onboarding.welcome.google")}
            </Button>
            <View style={styles.divider}>
              <Divider style={styles.dividerLine} />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("common.or")}
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
          {t("onboarding.welcome.emailSignup")}
        </Button>

        <Button
          mode="text"
          disabled={isSigningIn}
          onPress={() => {
            // The ask is recorded before the move: `/` re-states the landing
            // decision every time it regains focus, and the router passes back
            // through it on the way across. On record, that re-statement agrees
            // with where the user is going; without it, it sends them back.
            preferSignIn();
            router.replace("/sign-in");
          }}
        >
          {t("onboarding.welcome.signIn")}
        </Button>

        <LegalConsent prefix={t("onboarding.welcome.legalPrefix")} />
      </View>
    </SafeAreaView>
  );
}

function tilt(degrees: number) {
  return { transform: [{ rotate: `${degrees}deg` }] };
}

function Sticker({
  style,
  tint,
  label,
  amount,
}: {
  style: StyleProp<ViewStyle>;
  tint: string;
  label: string;
  amount: string;
}) {
  return (
    <View
      style={[
        styles.sticker,
        { backgroundColor: `${tint}${TINT_ALPHA.surface}` },
        style,
      ]}
    >
      <Text variant="labelSmall" style={{ color: tint }}>
        {label}
      </Text>
      <Text
        variant="labelLarge"
        style={[styles.stickerAmount, { color: tint }]}
      >
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  illustration: { alignItems: "center", paddingVertical: SPACING.lg },
  headlines: { gap: SPACING.sm },
  sticker: {
    position: "absolute",
    paddingHorizontal: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.xs + SPACING.xxs,
    borderRadius: RADIUS.md,
  },
  stickerAmount: { fontVariant: ["tabular-nums"], fontWeight: "700" },
  stickerTop: { top: 0, left: 0 },
  stickerBottomEnd: { bottom: SPACING.xl, right: 0 },
  stickerBottomStart: { bottom: 0, left: 0 },
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
