import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CURRENCY_METADATA } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";

import { OnboardingBudgetRing } from "../components/onboarding-budget-ring";
import { StepScaffold } from "../components/step-scaffold";
import {
  availableToSpend,
  blockToFix,
  emotionState,
  previewBlockNames,
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
import type { OnboardingStep } from "../onboarding-step";

type BlockKind = "income" | "expense" | "saving";

/**
 * What the six previous steps add up to: the ring and the verdict first, then
 * one row per block, each a way back into the step that produced it.
 */
export function BudgetPreviewStep({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const state = useOnboardingStore();

  const available = availableToSpend(state);
  const emotion = emotionState(state);
  const toFix = blockToFix(state);
  const charges = totalCharges(state);
  const savings = totalSavings(state);
  const currency = state.currency;
  const symbol = CURRENCY_METADATA[currency].symbol;

  const name = state.firstName.trim();
  const headline = t(`onboarding.preview.headline.${emotion}`);
  const sentence =
    emotion === "deficit"
      ? toFix === "charges"
        ? t("onboarding.preview.sentence.deficitCharges")
        : t("onboarding.preview.sentence.deficitSavings", {
            amount: formatCurrency(Math.abs(available), currency),
          })
      : t(`onboarding.preview.sentence.${emotion}`);

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
      title={name === "" ? `${headline}.` : `${headline}, ${name}.`}
      subtitle={sentence}
      onContinue={handleContinue}
      onExit={onExit}
    >
      <View style={styles.ring}>
        <OnboardingBudgetRing
          income={totalIncome(state)}
          charges={charges}
          savings={savings}
          currency={currency}
          subtitle={t(
            emotion === "deficit"
              ? "onboarding.preview.ringPerMonth"
              : "onboarding.preview.ringToSpend",
            { currency: symbol },
          )}
        />
      </View>

      <View style={styles.rows}>
        <BlockRow
          step="income"
          kind="income"
          title={t("onboarding.preview.income")}
          names={[
            t("onboarding.preview.salary"),
            ...previewBlockNames(state, "income"),
          ]}
          amount={`+${formatCurrency(totalIncome(state), currency)}`}
        />
        {charges > 0 && (
          <BlockRow
            step="charges"
            kind="expense"
            title={t("onboarding.preview.fixedCharges")}
            names={previewBlockNames(state, "expense")}
            amount={formatCurrency(charges, currency)}
            isToFix={toFix === "charges"}
          />
        )}
        {savings > 0 && (
          <BlockRow
            step="savings"
            kind="saving"
            title={t("onboarding.preview.plannedSavings")}
            names={previewBlockNames(state, "saving")}
            amount={formatCurrency(savings, currency)}
            isToFix={toFix === "savings"}
          />
        )}
      </View>

      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("onboarding.preview.template")}
      </Text>
    </StepScaffold>
  );
}

const ICONS: Record<BlockKind, keyof typeof MaterialCommunityIcons.glyphMap> = {
  income: "arrow-down-circle-outline",
  expense: "home-outline",
  saving: "piggy-bank-outline",
};

function BlockRow({
  step,
  kind,
  title,
  names,
  amount,
  isToFix = false,
}: {
  step: OnboardingStep;
  kind: BlockKind;
  title: string;
  names: string[];
  amount: string;
  isToFix?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  const tint =
    kind === "income"
      ? financial.income
      : kind === "expense"
        ? financial.expense
        : financial.savings;
  const [first, ...others] = names;

  return (
    <Pressable
      onPress={() => jumpToStepForEdit(step)}
      android_ripple={ripple}
      accessibilityRole="button"
      accessibilityLabel={t("onboarding.preview.edit", { label: title })}
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface, borderColor: v2.line },
      ]}
    >
      <MaterialCommunityIcons
        name={ICONS[kind]}
        size={ICON_SIZE.lg}
        color={tint}
      />
      <View style={styles.labels}>
        <Text variant="titleSmall">{title}</Text>
        {first !== undefined && (
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {others.length === 0
              ? first
              : t(
                  others.length === 1
                    ? "onboarding.preview.summaryOne"
                    : "onboarding.preview.summaryMany",
                  {
                    first,
                    count: others.length,
                  },
                )}
          </Text>
        )}
      </View>
      <Amount size="row" tone={isToFix ? "overBudget" : "neutral"}>
        {amount}
      </Amount>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center" },
  rows: { gap: SPACING.sm },
  row: {
    minHeight: TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labels: { flex: 1, gap: SPACING.xxs },
});
