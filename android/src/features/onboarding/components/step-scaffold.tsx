import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SPACING } from "@/core/ui/theme";

import {
  isStepInProgressBar,
  progressBarSteps,
  wouldExitOnBack,
} from "../onboarding-selectors";
import { STEP_COPY } from "../onboarding-step";
import { goToPreviousStep, useOnboardingStore } from "../onboarding-store";
import { ProgressDots } from "./progress-dots";

const BACK_ICON_SIZE = 24;

/**
 * The frame every step is drawn in: where the user is, what the step asks, and
 * the one control that moves the flow on. Navigation is by button only — no
 * swipe — so a half-answered step can never be skipped by a stray gesture.
 */
export function StepScaffold({
  children,
  ctaLabel = "Continuer",
  isCtaEnabled,
  isCtaBusy = false,
  onContinue,
  onSkip,
  onExit,
  footer,
}: {
  children: ReactNode;
  ctaLabel?: string;
  isCtaEnabled: boolean;
  isCtaBusy?: boolean;
  onContinue: () => void;
  /** Present on the optional steps, where "Passer" is a real answer. */
  onSkip?: () => void;
  /** Called instead of stepping back when back would leave the flow. */
  onExit?: () => void;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const state = useOnboardingStore();

  const step = state.currentStep;
  const copy = STEP_COPY[step];
  const bar = progressBarSteps(state);

  function handleBack() {
    if (state.editReturnStep === null && wouldExitOnBack(state)) {
      onExit?.();
      return;
    }
    goToPreviousStep();
  }

  function handleContinue() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinue();
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <IconButton
          icon={() => (
            <MaterialCommunityIcons
              name="arrow-left"
              size={BACK_ICON_SIZE}
              color={theme.colors.onSurfaceVariant}
            />
          )}
          onPress={handleBack}
          accessibilityLabel="Revenir à l'étape précédente"
        />
        <View style={styles.progress}>
          {isStepInProgressBar(state, step) && (
            <ProgressDots total={bar.length} currentIndex={bar.indexOf(step)} />
          )}
        </View>
        {/* Balances the back button so the dots stay centred. */}
        <View style={styles.headerSpacer} />
      </View>

      {/* A plain view, deliberately. Wrapping this in an entering
          `Animated.View` — a step sliding in from the side to say which way the
          flow moved — left it absolutely positioned over the whole safe area,
          so every step drew its title across the back arrow and its last field
          behind the CTA. Moving the animation inside the scroll instead
          collapsed the content height and the steps stopped scrolling at all.
          The frame is worth more than the flourish. */}
      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titles}>
            <Text variant="headlineMedium">{copy.title}</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {copy.subtitle}
            </Text>
          </View>

          {children}
        </ScrollView>
      </View>

      <View style={styles.actions}>
        {footer}
        <Button
          mode="contained"
          disabled={!isCtaEnabled || isCtaBusy}
          loading={isCtaBusy}
          onPress={handleContinue}
        >
          {ctaLabel}
        </Button>
        {onSkip !== undefined && (
          <Button mode="text" disabled={isCtaBusy} onPress={onSkip}>
            Passer cette étape
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  progress: { flex: 1, alignItems: "center" },
  headerSpacer: { width: SPACING.xxl },
  body: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  titles: { gap: SPACING.xs },
  actions: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
});
