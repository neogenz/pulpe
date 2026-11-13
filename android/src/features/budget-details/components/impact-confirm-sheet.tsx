import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatAmount } from "@/core/ui/amount-format";
import { FieldError } from "@/core/ui/field-error";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { FormModal } from "@/core/ui/sheet";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import type { DisponibleImpact, ImpactTone } from "../month-impact";
import { elidesMonth } from "../month-period";

/** What the block says: its caption, and the figure it moves, when it moves. */
export interface ImpactBlockContent {
  title: string;
  tone: ImpactTone;
  before?: number;
  after?: number;
  note?: string;
}

interface ImpactBlockProps extends ImpactBlockContent {
  currency: SupportedCurrency;
}

/**
 * What an action does to a figure, shown before the user validates —
 * `ImpactBlock.swift`: a caption, the « before » struck through, an arrow, the
 * « after ». A neutral block repeats no figure: its caption says nothing moves.
 */
export function ImpactBlock({
  title,
  tone,
  before,
  after,
  note,
  currency,
}: ImpactBlockProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  const fill =
    tone === "over" ? v2.overWash : tone === "ok" ? v2.accentWash : v2.sunk;
  const titleColor =
    tone === "over"
      ? financial.overBudget
      : tone === "ok"
        ? v2.accentInk
        : theme.colors.onSurfaceVariant;

  return (
    <View
      accessible
      accessibilityLabel={[
        title,
        before === undefined ? null : formatAmount(before, currency),
        after === undefined ? null : formatAmount(after, currency),
        note ?? null,
      ]
        .filter((part) => part !== null)
        .join(", ")}
      style={[styles.block, { backgroundColor: fill }]}
    >
      <Text variant="labelMedium" style={{ color: titleColor }}>
        {title}
      </Text>
      {after !== undefined && (
        <View style={styles.figures}>
          {before !== undefined && (
            <>
              <Text
                variant="titleMedium"
                style={[
                  TABULAR_DIGITS,
                  styles.before,
                  { color: v2.ink3, textDecorationColor: v2.ink3 },
                ]}
              >
                {formatAmount(before, currency)}
              </Text>
              <Text variant="titleMedium" style={{ color: v2.ink3 }}>
                →
              </Text>
            </>
          )}
          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatAmount(after, currency)}
          </Text>
        </View>
      )}
      {note !== undefined && (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {note}
        </Text>
      )}
    </View>
  );
}

/** The block for a computed impact: a figure that does not move is not repeated. */
export function impactBlockFor(
  impact: DisponibleImpact,
  title: string,
  note?: string,
): ImpactBlockContent {
  return impact.tone === "neutral"
    ? { title, tone: "neutral", note }
    : {
        title,
        tone: impact.tone,
        before: impact.before,
        after: impact.after,
        note,
      };
}

interface ImpactConfirmSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  title: string;
  /** One line break = one paragraph. */
  message?: string;
  impact?: ImpactBlockContent;
  /** One line under the message, e.g. « Tu auras quelques secondes pour annuler. » */
  note?: string;
  currency: SupportedCurrency;
  /** Red primary: the action removes something. */
  isDestructive?: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  /** Why the act cannot be taken right now, when it cannot. */
  confirmDisabled?: boolean;
  isBusy?: boolean;
  /** The failure of the last attempt, shown above the choices. */
  error?: string | null;
  /** Shown instead of the body while what it states is still being read. */
  isLoading?: boolean;
  loadingLabel?: string;
}

/**
 * The one confirmation of a money action: a question, what it touches, what it
 * does to the disponible, then the choices — `ImpactConfirmSheet.swift`.
 * Postponing, deleting a prévision or a month all ask through it. It never
 * closes itself: the caller owns what happens once the act succeeds.
 */
export function ImpactConfirmSheet({
  isVisible,
  onDismiss,
  title,
  message,
  impact,
  note,
  currency,
  isDestructive = false,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  isBusy = false,
  error = null,
  isLoading = false,
  loadingLabel,
}: ImpactConfirmSheetProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const { t } = useTranslation();

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={isBusy}
      title={title}
      footer={
        <>
          {error !== null && <FieldError visible>{error}</FieldError>}
          <Button
            mode="contained"
            buttonColor={isDestructive ? financial.destructive : undefined}
            onPress={onConfirm}
            disabled={confirmDisabled || isLoading || isBusy}
            loading={isBusy}
          >
            {confirmLabel}
          </Button>
          <Button onPress={onDismiss} disabled={isBusy}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {loadingLabel}
        </Text>
      ) : (
        <>
          {message?.split("\n").map((paragraph, index) => (
            <Text
              key={index}
              variant="bodyMedium"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {paragraph}
            </Text>
          ))}
          {note !== undefined && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {note}
            </Text>
          )}
          {impact !== undefined && (
            <ImpactBlock {...impact} currency={currency} />
          )}
        </>
      )}
    </FormModal>
  );
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** « Ton disponible de novembre » / « Ton disponible d'avril »: the block's caption when it names the month. */
export function availableOfTitle(t: Translate, monthName: string): string {
  return t(
    elidesMonth(monthName)
      ? "budgets.impact.availableOfElided"
      : "budgets.impact.availableOf",
    { month: monthName },
  );
}

/** « Ton disponible baisse de 80.00 », in the language of the caller. */
export function impactTitle(
  t: Translate,
  impact: DisponibleImpact,
  currency: SupportedCurrency,
): string {
  return t(`budgets.impact.${impact.tone}`, {
    amount: formatAmount(Math.abs(impact.delta), currency),
  });
}

const styles = StyleSheet.create({
  block: {
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
  figures: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
  before: { textDecorationLine: "line-through" },
});
