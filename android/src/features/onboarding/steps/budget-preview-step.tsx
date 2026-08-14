import { CURRENCY_METADATA } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { formatCompactAmount } from "@/core/ui/amount-format";
import { Eyebrow } from "@/core/ui/eyebrow";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING } from "@/core/ui/theme";

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
  const hero = useHeroColors();
  const state = useOnboardingStore();

  const available = availableToSpend(state);
  const emotion = emotionState(state);

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
      {/* The mint the dashboard uses, in every emotion — `home-hero-card.tsx`
          already made this choice and wrote down why: the verdict is in the ink
          and the caption, so a card that also changed colour says it twice. It
          mattered most here, where a coral card was the first red-adjacent
          surface a new user met, at the moment they were promised relief. */}
      <View style={[styles.hero, { backgroundColor: hero.surface }]}>
        <Eyebrow style={{ color: hero.support }}>
          {`Disponible à dépenser · ${CURRENCY_METADATA[state.currency].symbol}`}
        </Eyebrow>
        <Amount size="hero" style={{ color: hero.ink }}>
          {/* Compact, like the home hero this becomes one screen later: the
              same figure, printed two ways, reads as two figures. */}
          {formatCompactAmount(available, state.currency)}
        </Amount>
        <Text variant="bodySmall" style={{ color: hero.support }}>
          {EMOTION_CAPTION[emotion]}
        </Text>
      </View>

      <FlowBars
        currency={state.currency}
        flows={[
          {
            label: "Revenus",
            amount: totalIncome(state),
            accent: "income",
            onPress: () => jumpToStepForEdit("income"),
          },
          {
            label: "Charges",
            amount: totalCharges(state),
            accent: "expense",
            onPress: () => jumpToStepForEdit("charges"),
          },
          {
            label: "Épargne",
            amount: totalSavings(state),
            accent: "savings",
            onPress: () => jumpToStepForEdit("savings"),
          },
        ]}
      />
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
    gap: SPACING.xs,
  },
});
