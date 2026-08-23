import { useLinkingURL } from "expo-linking";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import {
  beginPasswordRecovery,
  parseRecoveryTokens,
  updatePassword,
} from "@/core/auth/password-recovery";
import {
  isAcceptablePassword,
  PASSWORD_MIN_LENGTH,
} from "@/core/auth/password-rules";
import { endRecoverySession, useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

type Phase =
  | { kind: "preparing" }
  | { kind: "dropped" }
  | { kind: "invalid" }
  | { kind: "form" }
  | { kind: "securityError" }
  | { kind: "done" };

/**
 * The reset link, `https://app.pulpe.app/reset-password`, opens here.
 *
 * Deliberately a root route rather than a member of `(auth)`: opening the link
 * establishes a recovery session, which flips the session status to
 * authenticated and would drop a guarded `(auth)` screen out of the navigator
 * mid-flow. Mirrors `ResetPasswordFlowView` on iOS, whose sheet lives above the
 * navigation state for the same reason.
 *
 * The routing decision itself mirrors `ResetPasswordDeepLinkPolicy`: defer
 * while the session is still loading, run the flow when signed out, ignore the
 * link when a real session is already open — consuming it would swap the
 * signed-in user out from under them.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const url = useLinkingURL();
  const keyboardHeight = useKeyboardHeight();
  const { t } = useTranslation();
  const status = useSessionStore((state) => state.status);
  const [phase, setPhase] = useState<Phase>({ kind: "preparing" });

  // The flow authenticates the user on purpose, so `status` stops being a
  // usable signal the moment it starts. Only the arrival state decides, once.
  const hasDecided = useRef(false);
  const hasRecoverySession = useRef(false);
  const isLeaving = useRef(false);
  const hasChangedPassword = useRef(false);
  const endingRecovery = useRef<ReturnType<typeof endRecoverySession> | null>(
    null,
  );

  const endRecovery = useCallback(async () => {
    if (!hasRecoverySession.current) return null;

    const ending = (endingRecovery.current ??= endRecoverySession());
    try {
      const { providerError } = await ending;
      hasRecoverySession.current = false;
      return providerError;
    } finally {
      if (endingRecovery.current === ending) endingRecovery.current = null;
    }
  }, []);

  const leave = useCallback(async () => {
    if (isLeaving.current) return;
    isLeaving.current = true;
    try {
      await endRecovery();
      router.replace("/");
    } catch {
      isLeaving.current = false;
      setPhase({ kind: "securityError" });
    }
  }, [endRecovery, router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        void leave();
        return true;
      },
    );
    return () => subscription.remove();
  }, [leave]);

  useEffect(() => {
    if (hasDecided.current) return;
    if (status === "loading" || url === null) return;
    hasDecided.current = true;
    const wasSignedIn = status === "authenticated";
    let cancelled = false;

    void (async () => {
      if (wasSignedIn) {
        setPhase({ kind: "dropped" });
        return;
      }

      const tokens = parseRecoveryTokens(url);
      if (tokens === null) {
        setPhase({ kind: "invalid" });
        return;
      }

      try {
        await beginPasswordRecovery(tokens);
        hasRecoverySession.current = true;
        if (cancelled || isLeaving.current) {
          await endRecovery();
          return;
        }
        setPhase({ kind: "form" });
      } catch {
        if (!cancelled && !isLeaving.current) setPhase({ kind: "invalid" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endRecovery, status, url]);

  if (phase.kind === "dropped") return <Redirect href="/" />;

  const complete = async (password: string) => {
    if (hasChangedPassword.current) return;
    await updatePassword(password);
    hasChangedPassword.current = true;
    if (isLeaving.current) return;
    try {
      const providerError = await endRecovery();
      setPhase({ kind: providerError === null ? "done" : "securityError" });
    } catch {
      setPhase({ kind: "securityError" });
    }
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.Content title={t("auth.reset.title")} />
        <Appbar.Action
          icon="close"
          accessibilityLabel={t("common.close")}
          onPress={() => void leave()}
        />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SPACING.lg + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {phase.kind === "preparing" && <PreparingState />}
        {phase.kind === "invalid" && (
          <InvalidState onLeave={() => void leave()} />
        )}
        {phase.kind === "form" && <PasswordForm onSubmit={complete} />}
        {phase.kind === "securityError" && (
          <SecurityErrorState onLeave={() => void leave()} />
        )}
        {phase.kind === "done" && <DoneState onLeave={() => void leave()} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function SecurityErrorState({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <Text variant="titleLarge" style={styles.title}>
        {t("auth.reset.securityTitle")}
      </Text>
      <Text variant="bodyMedium" style={styles.title}>
        {t("auth.reset.securityBody")}
      </Text>
      <Button mode="contained" onPress={onLeave}>
        {t("common.backToSignIn")}
      </Button>
    </View>
  );
}

function PreparingState() {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <ActivityIndicator accessibilityLabel={t("auth.reset.verifying")} />
      <Text variant="bodyMedium">{t("auth.reset.verifying")}</Text>
    </View>
  );
}

function InvalidState({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <Text variant="titleLarge" style={styles.title}>
        {t("auth.reset.invalidTitle")}
      </Text>
      <Text variant="bodyMedium" style={styles.title}>
        {t("auth.reset.invalidBody")}
      </Text>
      <Button mode="contained" onPress={onLeave}>
        {t("common.backToSignIn")}
      </Button>
    </View>
  );
}

function DoneState({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <Text variant="titleLarge" style={styles.title}>
        {t("auth.reset.doneTitle")}
      </Text>
      <Text variant="bodyMedium" style={styles.title}>
        {t("auth.reset.doneBody")}
      </Text>
      <Button mode="contained" onPress={onLeave}>
        {t("common.backToSignIn")}
      </Button>
    </View>
  );
}

function PasswordForm({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!isAcceptablePassword(password)) {
      setErrorMessage(
        t("auth.reset.passwordRule", { count: PASSWORD_MIN_LENGTH }),
      );
      return;
    }
    if (password !== confirmation) {
      setErrorMessage(t("auth.reset.mismatch"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(password);
    } catch {
      setErrorMessage(t("auth.reset.error"));
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Text variant="bodyMedium">{t("auth.reset.intro")}</Text>

      <TextInput
        mode="outlined"
        label={t("auth.reset.newPassword")}
        placeholder={t("auth.reset.minimum", { count: PASSWORD_MIN_LENGTH })}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        disabled={isSubmitting}
      />
      <TextInput
        mode="outlined"
        label={t("auth.reset.confirmPassword")}
        placeholder={t("auth.reset.confirmPlaceholder")}
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        disabled={isSubmitting}
      />

      {errorMessage !== null && <FieldError visible>{errorMessage}</FieldError>}

      <Button
        mode="contained"
        loading={isSubmitting}
        disabled={isSubmitting || password.length === 0}
        onPress={() => void submit()}
        accessibilityLabel={
          isSubmitting ? t("auth.reset.submitting") : undefined
        }
      >
        {t("auth.reset.submit")}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  title: { textAlign: "center" },
});
