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
import { useKeyboardHeight } from "@/core/ui/keyboard-inset";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

const INVALID_LINK_MESSAGE =
  "Ce lien n'est plus valide. Demande un nouveau lien depuis l'écran de connexion.";

type Phase =
  | { kind: "preparing" }
  | { kind: "dropped" }
  | { kind: "invalid" }
  | { kind: "form" }
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
  const status = useSessionStore((state) => state.status);
  const [phase, setPhase] = useState<Phase>({ kind: "preparing" });

  // The flow authenticates the user on purpose, so `status` stops being a
  // usable signal the moment it starts. Only the arrival state decides, once.
  const hasDecided = useRef(false);
  const hasRecoverySession = useRef(false);
  const isLeaving = useRef(false);
  const endingRecovery = useRef<Promise<void> | null>(null);

  const endRecovery = useCallback(async () => {
    if (!hasRecoverySession.current) return;

    endingRecovery.current ??= endRecoverySession().finally(() => {
      hasRecoverySession.current = false;
      endingRecovery.current = null;
    });
    await endingRecovery.current;
  }, []);

  const leave = useCallback(async () => {
    if (isLeaving.current) return;
    isLeaving.current = true;
    try {
      await endRecovery();
    } finally {
      router.replace("/");
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
    await updatePassword(password);
    if (isLeaving.current) return;
    try {
      await endRecovery();
    } catch {
      throw new Error(
        "Ton mot de passe a été modifié, mais la déconnexion de sécurité a échoué. Retourne à la connexion.",
      );
    }
    if (!isLeaving.current) setPhase({ kind: "done" });
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.Content title="Réinitialiser le mot de passe" />
        <Appbar.Action
          icon="close"
          accessibilityLabel="Fermer"
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
        {phase.kind === "done" && <DoneState onLeave={() => void leave()} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreparingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator accessibilityLabel="Vérification du lien en cours" />
      <Text variant="bodyMedium">Vérification du lien...</Text>
    </View>
  );
}

function InvalidState({ onLeave }: { onLeave: () => void }) {
  return (
    <View style={styles.centered}>
      <Text variant="titleLarge" style={styles.title}>
        Lien invalide ou expiré
      </Text>
      <Text variant="bodyMedium" style={styles.title}>
        {INVALID_LINK_MESSAGE}
      </Text>
      <Button mode="contained" onPress={onLeave}>
        Retour à la connexion
      </Button>
    </View>
  );
}

function DoneState({ onLeave }: { onLeave: () => void }) {
  return (
    <View style={styles.centered}>
      <Text variant="titleLarge" style={styles.title}>
        Mot de passe réinitialisé
      </Text>
      <Text variant="bodyMedium" style={styles.title}>
        Reconnecte-toi avec ton nouveau mot de passe.
      </Text>
      <Button mode="contained" onPress={onLeave}>
        Retour à la connexion
      </Button>
    </View>
  );
}

function PasswordForm({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!isAcceptablePassword(password)) {
      setErrorMessage(
        `${PASSWORD_MIN_LENGTH} caractères minimum, avec au moins une lettre et un chiffre.`,
      );
      return;
    }
    if (password !== confirmation) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(password);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Quelque chose n'a pas fonctionné — réessaie.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Text variant="bodyMedium">Définis ton nouveau mot de passe.</Text>

      <TextInput
        mode="outlined"
        label="Nouveau mot de passe"
        placeholder={`${PASSWORD_MIN_LENGTH} caractères minimum`}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        disabled={isSubmitting}
      />
      <TextInput
        mode="outlined"
        label="Confirmer le nouveau mot de passe"
        placeholder="Confirme ton nouveau mot de passe"
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
          isSubmitting ? "Réinitialisation en cours" : undefined
        }
      >
        Valider
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
