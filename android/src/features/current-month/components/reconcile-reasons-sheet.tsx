import type { SupportedCurrency } from "pulpe-shared";
import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Icon, ProgressBar, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { areAmountsHidden } from "@/core/ui/amount-visibility";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { FormModal } from "@/core/ui/sheet";
import {
  ACCESSIBLE_FONT_SCALE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import { plain } from "../reconciliation";
import { AmountButton, arrowed, money, signed } from "./reconcile-compare-step";

/**
 * The narrowest a card picture sits beside the other: « ☑ Clothes 350.00 »,
 * the longest sample, on one line at the normal font size. Scaled with the
 * font, so a column that cannot hold it puts the pictures one under the other.
 */
const SIDE_BY_SIDE_WIDTH = 172;

export type ReasonChoice = "addOwe" | "noteIncome" | "reviewAccounts" | "leave";

type Reason = "card" | "partlySpent" | "income" | "savings";

/** A checked expense prévision with money still on it. */
export interface PartlySpentLine {
  name: string;
  amount: number;
  spent: number;
  left: number;
}

/** What the sheet shows, as the step was when it opened it. */
export interface ReasonsSnapshot {
  /** Above 0: my accounts hold more than Pulpe. */
  gap: number;
  hasOwe: boolean;
  partlySpent: PartlySpentLine | null;
  /** « Disponible : avant → après » once the gap is noted as an income. */
  note: { before: number; after: number };
}

/** Fixed order, each kept only when it can be the cause, three at most (spec.md §4.4). */
export function reasonsFor(hasOwe: boolean, hasPartlySpent: boolean): Reason[] {
  return (["card", "partlySpent", "income", "savings"] as const)
    .filter((reason) =>
      reason === "card"
        ? !hasOwe
        : reason === "partlySpent"
          ? hasPartlySpent
          : true,
    )
    .slice(0, 3);
}

/**
 * « D'où viennent ces … ? »: the likely causes of my accounts holding more
 * than Pulpe, each with a small picture. The sheet only answers; the step does
 * what that answer does there (`ReconcileReasonsSheet` on iOS).
 */
export function ReconcileReasonsSheet({
  isVisible,
  reasons,
  currency,
  onDismiss,
  onChoose,
}: {
  isVisible: boolean;
  reasons: ReasonsSnapshot;
  currency: SupportedCurrency;
  onDismiss: () => void;
  onChoose: (choice: ReasonChoice) => void;
}) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const financial = useFinancialColors();
  const { locale, t } = useTranslation();
  const fontScale = useWindowDimensions().fontScale;
  // A large font puts an amount under its name, as iOS does at accessibility sizes.
  const stacks = fontScale >= ACCESSIBLE_FONT_SCALE;
  const { gap, partlySpent, note } = reasons;
  const isHidden = areAmountsHidden();
  const muted = { color: theme.colors.onSurfaceVariant };
  // White on the card, as iOS sets its sunk picture apart from its white card.
  const picture = [styles.picture, { backgroundColor: theme.colors.surface }];
  const half = [
    picture,
    // Never wider than the row: at a large font the basis outgrows a phone.
    {
      flexGrow: 1,
      flexBasis: SIDE_BY_SIDE_WIDTH * fontScale,
      maxWidth: "100%" as const,
    },
  ];
  const caption = (text: string) => (
    <Text
      variant="bodySmall"
      style={[muted, TABULAR_DIGITS]}
      accessibilityLabel={text}
    >
      {arrowed(text, theme.fonts.bodySmall.fontSize)}
    </Text>
  );
  // Paper's button keeps its label on one line and cuts it at a large font: this one wraps.
  const outlined = (label: string, choice: ReasonChoice) => (
    <View style={styles.start}>
      <AmountButton
        label={label}
        onPress={() => onChoose(choice)}
        isDisabled={false}
        isOutlined
      />
    </View>
  );
  // A line as a bank shows it: its name, where it stands, its amount.
  const sample = (name: string, chip: string, amount: string, ink: string) => (
    <View
      style={[picture, !stacks && styles.row]}
      testID="reconcile-reason-sample"
    >
      <View style={stacks ? styles.lines : styles.grow}>
        <Text variant="bodyMedium">{name}</Text>
        <Text
          variant="labelSmall"
          style={[muted, styles.chip, { backgroundColor: v2.sunk }]}
        >
          {chip}
        </Text>
      </View>
      <Text variant="titleSmall" style={[TABULAR_DIGITS, { color: ink }]}>
        {amount}
      </Text>
    </View>
  );
  const bodies: Record<Reason, ReactNode> = {
    card: (
      <>
        <Question text={t("home.reconcile.compare.cardQuestion")} />
        <View style={styles.pictures}>
          <View style={half} testID="reconcile-card-picture">
            {caption("Pulpe")}
            <View style={styles.row}>
              <Icon
                source="checkbox-marked"
                size={18}
                color={theme.colors.primary}
              />
              {/* Wraps rather than cuts: the sample reads whole on a phone. */}
              <Text variant="bodyMedium" style={styles.grow}>
                {t("home.reconcile.reasons.cardSample")}
              </Text>
              {/* A sample, never my money: bare, like the small gap's café. */}
              <Text variant="bodyMedium" style={TABULAR_DIGITS}>
                {plain(350, currency)}
              </Text>
            </View>
          </View>
          <View style={half}>
            {caption(t("home.reconcile.reasons.bank"))}
            {caption(t("home.reconcile.reasons.notYetThere"))}
          </View>
        </View>
        {outlined(t("home.reconcile.accounts.addOwe"), "addOwe")}
      </>
    ),
    partlySpent: partlySpent !== null && (
      <>
        <Question text={t("home.reconcile.reasons.partlySpentQuestion")} />
        <View style={picture}>
          {/* Its amount under it at a large font, the name whole, as on iOS. */}
          <View
            style={stacks ? styles.lines : styles.row}
            testID="reconcile-reason-partly-spent-line"
          >
            <View style={[styles.row, !stacks && styles.fill]}>
              <Icon
                source="checkbox-marked"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                variant="bodyMedium"
                numberOfLines={stacks ? undefined : 1}
                style={styles.fill}
              >
                {isHidden ? "•••" : partlySpent.name}
              </Text>
            </View>
            <Text variant="bodyMedium" style={TABULAR_DIGITS}>
              {money(partlySpent.amount, currency)}
            </Text>
          </View>
          {/* Spent over planned is an amount too: masked with them, silent to TalkBack. */}
          {!isHidden && (
            <View
              importantForAccessibility="no-hide-descendants"
              testID="reconcile-reasons-bar"
            >
              <ProgressBar progress={partlySpent.spent / partlySpent.amount} />
            </View>
          )}
          <View style={[styles.row, styles.apart]}>
            {caption(
              t("home.reconcile.reasons.spent", {
                amount: money(partlySpent.spent, currency),
              }),
            )}
            {caption(
              t("home.reconcile.reasons.left", {
                amount: money(partlySpent.left, currency),
              }),
            )}
          </View>
        </View>
        <View style={styles.row}>
          <Icon source="check-circle" size={24} color={theme.colors.primary} />
          <Text variant="titleSmall">
            {t("home.reconcile.reasons.nothingToDo")}
          </Text>
        </View>
      </>
    ),
    income: (
      <>
        <Question text={t("home.reconcile.reasons.incomeQuestion")} />
        {sample(
          t("home.reconcile.reasons.incomeSample", {
            // « 21 nov. », as iOS and the web abbreviate it.
            date: new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
            }).format(new Date()),
          }),
          t("home.reconcile.reasons.notInPulpe"),
          signed(gap, currency),
          financial.income,
        )}
        <AmountButton
          label={t("home.reconcile.compare.noteIncome", {
            amount: money(gap, currency),
          })}
          onPress={() => onChoose("noteIncome")}
          isDisabled={false}
          isOutlined
        />
        {caption(
          t("home.reconcile.compare.availableNote", {
            before: money(note.before, currency),
            after: money(note.after, currency),
          }),
        )}
      </>
    ),
    savings: (
      <>
        <Question text={t("home.reconcile.reasons.savingsQuestion")} />
        {sample(
          t("home.reconcile.reasons.savingsSample"),
          t("home.reconcile.reasons.toRemove"),
          money(gap, currency),
          theme.colors.onSurface,
        )}
        {outlined(t("home.reconcile.reasons.reviewAccounts"), "reviewAccounts")}
      </>
    ),
  };

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      // The sheet's name carries no amount; the heading under it says how much.
      title={t("home.reconcile.reasons.label")}
      hasBodyHeading
    >
      <Text
        variant="headlineSmall"
        accessibilityRole="header"
        textBreakStrategy="balanced"
        style={TABULAR_DIGITS}
      >
        {t("home.reconcile.reasons.title", {
          // A plain space before the currency: at a large font it goes to the
          // next line, where the unbreakable « 3’500.00 CHF » would be cut.
          amount: formatCurrency(gap, currency),
        })}
      </Text>
      {reasonsFor(reasons.hasOwe, partlySpent !== null).map((reason) => (
        <View
          key={reason}
          style={[
            styles.card,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          testID={`reconcile-reason-${reason}`}
        >
          {bodies[reason]}
        </View>
      ))}
      <Button
        mode="text"
        onPress={() => onChoose("leave")}
        contentStyle={styles.target}
      >
        {t("home.reconcile.compare.leaveAsIs")}
      </Button>
    </FormModal>
  );
}

function Question({ text }: { text: string }) {
  return (
    <Text variant="titleMedium" textBreakStrategy="balanced">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.md },
  picture: { borderRadius: RADIUS.sm, padding: SPACING.md, gap: SPACING.xs },
  pictures: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  apart: { justifyContent: "space-between", flexWrap: "wrap" },
  grow: { flex: 1, gap: SPACING.xs },
  lines: { gap: SPACING.xs },
  fill: { flex: 1 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  start: { alignSelf: "flex-start" },
  target: { minHeight: TOUCH_TARGET },
});
