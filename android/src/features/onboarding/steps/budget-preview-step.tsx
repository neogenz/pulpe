import { CURRENCY_METADATA } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
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

/**
 * What the six previous steps add up to. The one number that matters is shown
 * first and largest; the flows below it explain where the rest went, and every
 * row is a way back into the step that produced it.
 */
export function BudgetPreviewStep({ onExit }: { onExit: () => void }) {
  const hero = useHeroColors();
  const { t } = useTranslation();
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
      ctaLabel={t("onboarding.preview.start")}
      title={t("onboarding.preview.title")}
      subtitle={t("onboarding.preview.subtitle")}
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
          {t("onboarding.preview.available", {
            currency: CURRENCY_METADATA[state.currency].symbol,
          })}
        </Eyebrow>
        <Amount size="hero" style={{ color: hero.ink }}>
          {/* Compact, like the home hero this becomes one screen later: the
              same figure, printed two ways, reads as two figures. */}
          {formatCompactAmount(available, state.currency)}
        </Amount>
        <Text variant="bodySmall" style={{ color: hero.support }}>
          {t(`onboarding.preview.emotion.${emotion}`)}
        </Text>
      </View>

      <FlowBars
        currency={state.currency}
        editHint={(label) => t("onboarding.preview.edit", { label })}
        flows={[
          {
            label: t("onboarding.preview.income"),
            amount: totalIncome(state),
            accent: "income",
            onPress: () => jumpToStepForEdit("income"),
          },
          {
            label: t("onboarding.preview.expenses"),
            amount: totalCharges(state),
            accent: "expense",
            onPress: () => jumpToStepForEdit("charges"),
          },
          {
            label: t("onboarding.preview.savings"),
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
