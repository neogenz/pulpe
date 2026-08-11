import { getCurrencyFormatter } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { HERO_TINTS, RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import { FlowBars } from "../components/flow-bars";
import { StepScaffold } from "../components/step-scaffold";
import {
  availableToSpend,
  emotionState,
  totalCharges,
  totalIncome,
  totalSavings,
} from "../onboarding-selectors";
import {
  goToNextStep,
  jumpToStepForEdit,
  useOnboardingStore,
} from "../onboarding-store";
import { submitOnboarding } from "../onboarding-submission";

const HERO_TINT_OPACITY = "26";

const EMOTION_CAPTION = {
  comfortable:
    "Tu as de la marge. C'est ce qu'il te reste après tout le reste.",
  tight: "Ça passe, mais c'est serré. Tu pourras ajuster à tout moment.",
  deficit:
    "Tes dépenses passent devant tes revenus — on va regarder ça ensemble.",
} as const;

/**
 * What the six previous steps add up to. The one number that matters is shown
 * first and largest; the flows below it explain where the rest went, and every
 * row is a way back into the step that produced it.
 */
export function BudgetPreviewStep({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const state = useOnboardingStore();

  const available = availableToSpend(state);
  const emotion = emotionState(state);
  const formatter = getCurrencyFormatter(state.currency);

  // The PIN ceremony is the next step until it has been done; after that the
  // CTA is the submission itself.
  function handleContinue() {
    if (goToNextStep()) return;
    void submitOnboarding();
  }

  return (
    <StepScaffold
      isCtaEnabled
      ctaLabel="C'est parti"
      onContinue={handleContinue}
      onExit={onExit}
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: `${HERO_TINTS[emotion]}${HERO_TINT_OPACITY}` },
        ]}
      >
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Disponible à dépenser
        </Text>
        <Text variant="displaySmall" style={TABULAR_DIGITS}>
          {formatter.format(available)}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {EMOTION_CAPTION[emotion]}
        </Text>
      </View>

      <FlowBars
        currency={state.currency}
        flows={[
          { label: "Revenus", amount: totalIncome(state), accent: "income" },
          { label: "Charges", amount: totalCharges(state), accent: "expense" },
          { label: "Épargne", amount: totalSavings(state), accent: "savings" },
        ]}
      />

      <View style={styles.edits}>
        <Button icon="pencil" onPress={() => jumpToStepForEdit("income")}>
          Modifier mes revenus
        </Button>
        <Button icon="pencil" onPress={() => jumpToStepForEdit("charges")}>
          Modifier mes charges
        </Button>
        <Button icon="pencil" onPress={() => jumpToStepForEdit("savings")}>
          Modifier mon épargne
        </Button>
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
    gap: SPACING.xs,
  },
  edits: { alignItems: "flex-start" },
});
