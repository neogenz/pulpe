import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { type ReactNode, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Icon,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency, formatSignedCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { useRipple } from "@/core/ui/ripple";
import { useV2Colors } from "@/core/ui/scheme-colors";
import {
  ACCESSIBLE_FONT_SCALE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import { type Comparison, plain, type SuggestionRow } from "../reconciliation";

/** Above the app's 56dp rows: a suggestion carries a second line (spec.md §4.2). */
const SUGGESTION_MIN_HEIGHT = 64;
/** The round mark over « Pareil des deux côtés », twice its check. */
const MARK_SIZE = 2 * ICON_SIZE.xl;

/** An amount and its currency never part across two lines; a true minus, as on web and iOS. */
export function money(value: number, currency: SupportedCurrency): string {
  return formatCurrency(value, currency).replace(/ /g, " ").replace("-", "−");
}

export function signed(value: number, currency: SupportedCurrency): string {
  return formatSignedCurrency(value, currency)
    .replace(/ /g, " ")
    .replace("-", "−");
}

interface ReconcileCompareStepProps {
  /** `null` until the server context is read: the figure would be wrong without it. */
  comparison: Comparison | null;
  /** The context read failed: nothing to compare, nothing to write. */
  isUnavailable: boolean;
  onRetry: () => void;
  currency: SupportedCurrency;
  hasOwe: boolean;
  /** What the « Je dois » rows total, when removing them is offered. */
  oweTotal: number | null;
  checkingId: string | null;
  isBusy: boolean;
  onCheck: (row: SuggestionRow) => void;
  onRemoveOwe: () => void;
  onViewOthers: () => void;
  /** [Ajouter ce que je dois]: back to step 1 with a new « Je dois » row. */
  onAddOwe: () => void;
  onEditStartingAmount: () => void;
}

/**
 * Step 2, the verdict, the two figures and the screen the numbers call for
 * (spec.md §4). `ReconcileCompareStepView` on iOS. The actions are the
 * sheet's footer, `ReconcileCompareActions`.
 */
export function ReconcileCompareStep({
  comparison,
  isUnavailable,
  onRetry,
  currency,
  hasOwe,
  oweTotal,
  checkingId,
  isBusy,
  onCheck,
  onRemoveOwe,
  onViewOthers,
  onAddOwe,
  onEditStartingAmount,
}: ReconcileCompareStepProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const ripple = useRipple();
  const { locale, t } = useTranslation();
  const stacks = useStacksAmounts();
  const heading = useRef<View>(null);
  const rows = useRef<(View | null)[]>([]);
  // Where the checked row stood (-1: the title). It leaves, taking TalkBack's focus with it.
  const refocusAt = useRef<number | null>(null);
  const muted = { color: theme.colors.onSurfaceVariant };
  const link = isBusy ? theme.colors.onSurfaceDisabled : theme.colors.primary;
  const card = [styles.card, { backgroundColor: theme.colors.surfaceVariant }];
  const screen =
    comparison?.screen ?? (isUnavailable ? "unavailable" : "loading");

  // A new screen swaps the content under a button that stays put: the title takes the focus.
  useEffect(() => {
    if (heading.current) {
      AccessibilityInfo.sendAccessibilityEvent(heading.current, "focus");
    }
  }, [screen]);
  // Once a check has settled: the row now at its place, else the title.
  useEffect(() => {
    if (checkingId !== null || refocusAt.current === null) return;
    const count = comparison?.suggestions.length ?? 0;
    const target =
      rows.current[Math.min(refocusAt.current, count - 1)] ?? heading.current;
    refocusAt.current = null;
    if (target) AccessibilityInfo.sendAccessibilityEvent(target, "focus");
  });

  const stepLabel = (
    <Text variant="labelMedium" style={muted}>
      {t("home.reconcile.compare.stepLabel")}
    </Text>
  );

  if (comparison === null) {
    return isUnavailable ? (
      <View style={styles.header} testID="reconcile-context-error">
        {stepLabel}
        <View ref={heading} accessible accessibilityRole="header">
          <Text variant="titleLarge">
            {t("home.reconcile.compare.loadError")}
          </Text>
        </View>
        <Button mode="contained-tonal" onPress={onRetry} style={styles.start}>
          {t("common.retry")}
        </Button>
      </View>
    ) : (
      <ActivityIndicator style={styles.loading} />
    );
  }

  const { gap, matched } = comparison;
  const title =
    gap === 0
      ? t("home.reconcile.compare.matched")
      : t(
          gap < 0
            ? "home.reconcile.compare.less"
            : "home.reconcile.compare.more",
          { amount: money(Math.abs(gap), currency) },
        );
  const progress =
    comparison.comparedBefore === null
      ? 0
      : Math.min(
          1,
          comparison.found /
            Math.abs(comparison.onAccounts - comparison.comparedBefore),
        );

  return (
    <>
      <View style={styles.header}>
        {stepLabel}
        {/* Live: a check moves the verdict while the focus stays on the list. */}
        <View
          ref={heading}
          accessible
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          <Text
            variant="headlineSmall"
            textBreakStrategy="balanced"
            testID="reconcile-step-heading"
          >
            {title}
          </Text>
        </View>
      </View>

      {screen === "matched" ? (
        <>
          <View
            style={[styles.mark, { backgroundColor: v2.accentWash }]}
            importantForAccessibility="no-hide-descendants"
          >
            <Icon
              source="check"
              size={ICON_SIZE.xl}
              color={theme.colors.primary}
            />
          </View>
          <View style={card} testID="reconcile-matched">
            {/* The figure the lines below start from, to redo the sum by eye. */}
            <Figure
              label={t("home.reconcile.compare.onAccounts")}
              amount={money(comparison.onAccounts, currency)}
            />
            {matched.stillPlanned !== 0 && (
              <Figure
                label={t(
                  matched.stillPlanned < 0
                    ? "home.reconcile.compare.stillPlanned"
                    : "home.reconcile.compare.stillToReceive",
                )}
                amount={signed(matched.stillPlanned, currency)}
              />
            )}
            {matched.beforePulpe !== 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={onEditStartingAmount}
                disabled={isBusy}
                android_ripple={ripple}
                style={styles.tappable}
                testID="reconcile-starting-amount"
              >
                <View style={styles.grow}>
                  <Figure
                    label={t("home.reconcile.compare.beforePulpe")}
                    amount={signed(matched.beforePulpe, currency)}
                  />
                </View>
                <Icon
                  source="pencil-outline"
                  size={ICON_SIZE.sm}
                  color={muted.color}
                />
              </Pressable>
            )}
            <View style={stacks ? styles.stacked : styles.figure}>
              <Text variant="titleSmall" style={!stacks && styles.grow}>
                {t("home.reconcile.compare.toSpend")}
              </Text>
              {/* Green only when something is left: an overspent month is no good news. */}
              <Amount
                size="row"
                numberOfLines={1}
                style={
                  matched.remaining >= 0 && { color: theme.colors.primary }
                }
              >
                {money(matched.remaining, currency)}
              </Amount>
            </View>
          </View>
        </>
      ) : (
        <View style={card} testID="reconcile-figures">
          <Figure
            label={t("home.reconcile.compare.onAccounts")}
            amount={money(comparison.onAccounts, currency)}
          />
          {/* One stop for TalkBack, the new figure before the one it replaces. */}
          <View
            style={stacks ? styles.stacked : styles.figure}
            accessible
            accessibilityLabel={[
              t("home.reconcile.compare.inPulpe"),
              money(comparison.realized, currency),
              ...(comparison.realizedBefore === null
                ? []
                : [
                    t("home.reconcile.compare.instead", {
                      amount: money(comparison.realizedBefore, currency),
                    }),
                  ]),
            ].join(", ")}
            testID="reconcile-in-pulpe"
          >
            <Text variant="bodyMedium" style={[muted, !stacks && styles.grow]}>
              {t("home.reconcile.compare.inPulpe")}
            </Text>
            <View style={!stacks && styles.figures}>
              {comparison.realizedBefore !== null && (
                <View testID="reconcile-compared-before">
                  <Amount
                    size="meta"
                    numberOfLines={1}
                    style={[styles.struck, { color: v2.ink3 }]}
                  >
                    {money(comparison.realizedBefore, currency)}
                  </Amount>
                </View>
              )}
              <Amount size="row" numberOfLines={1}>
                {money(comparison.realized, currency)}
              </Amount>
            </View>
          </View>
          {comparison.startingAmount !== 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={onEditStartingAmount}
              disabled={isBusy}
              android_ripple={ripple}
              style={[styles.tappable, stacks ? styles.start : styles.end]}
              testID="reconcile-starting-amount"
            >
              <Text
                variant="labelLarge"
                style={[styles.recordLabel, TABULAR_DIGITS]}
              >
                {t("home.reconcile.compare.startingAmountPart", {
                  amount: signed(comparison.startingAmount, currency),
                })}
              </Text>
              <Icon
                source="pencil-outline"
                size={ICON_SIZE.sm}
                color={muted.color}
              />
            </Pressable>
          )}
          {/* As on web and iOS: nothing found, no line. */}
          {comparison.found > 0 && (
            <View style={styles.found} testID="reconcile-found">
              <View style={styles.grow} importantForAccessibility="no">
                <ProgressBar progress={progress} />
              </View>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.primary }}
              >
                {t("home.reconcile.compare.found", {
                  amount: money(comparison.found, currency),
                })}
              </Text>
            </View>
          )}
        </View>
      )}

      {screen === "suggestions" && (
        <>
          <Text variant="bodyMedium" textBreakStrategy="balanced">
            {t(
              gap > 0
                ? "home.reconcile.compare.leadIncome"
                : hasOwe
                  ? "home.reconcile.compare.leadCard"
                  : offersSaving(comparison)
                    ? "home.reconcile.compare.leadExpenseSaving"
                    : "home.reconcile.compare.leadExpense",
            )}
          </Text>
          <View style={[card, styles.list]}>
            {comparison.suggestions.map((row, index) => {
              const isChecking = checkingId === row.id;
              const amount = (
                <View
                  style={[
                    row.settles && [
                      styles.settles,
                      { backgroundColor: v2.accentWash },
                    ],
                    stacks && styles.start,
                  ]}
                >
                  <Amount size="row" numberOfLines={1}>
                    {money(row.amount, currency)}
                  </Amount>
                </View>
              );
              return (
                <Pressable
                  key={row.id}
                  ref={(node) => {
                    rows.current[index] = node;
                  }}
                  onPress={() => {
                    refocusAt.current = index;
                    onCheck(row);
                  }}
                  disabled={isBusy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecking, disabled: isBusy }}
                  android_ripple={ripple}
                  style={styles.suggestion}
                  testID="reconcile-suggestion"
                >
                  <Icon
                    source={isChecking ? "check-circle" : "circle-outline"}
                    size={ICON_SIZE.lg}
                    color={isChecking ? theme.colors.primary : v2.pointRing}
                  />
                  <View style={styles.grow}>
                    <Text
                      variant="bodyLarge"
                      numberOfLines={stacks ? undefined : 2}
                    >
                      {row.name}
                    </Text>
                    <Text variant="bodySmall" style={muted}>
                      {row.date !== null
                        ? formatDayMonth(new Date(row.date), locale)
                        : t("home.reconcile.compare.plannedThisMonth")}
                    </Text>
                    {stacks && amount}
                  </View>
                  {!stacks && amount}
                </Pressable>
              );
            })}
          </View>
          {comparison.othersCount > 0 && (
            // Not Paper's text button: its label is one line, cut at a large font.
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy }}
              onPress={onViewOthers}
              disabled={isBusy}
              android_ripple={ripple}
              style={[styles.tappable, styles.start, styles.link]}
            >
              <Icon source="arrow-right" size={ICON_SIZE.md} color={link} />
              <Text
                variant="labelLarge"
                style={[styles.shrink, { color: link }]}
              >
                {t(
                  comparison.othersCount === 1
                    ? "home.reconcile.compare.othersOne"
                    : "home.reconcile.compare.othersMany",
                  { count: comparison.othersCount },
                )}
              </Text>
            </Pressable>
          )}
          {oweTotal !== null && (
            <View style={card} testID="reconcile-owe-box">
              <Text variant="bodyMedium" textBreakStrategy="balanced">
                {t("home.reconcile.compare.oweQuestion")}
              </Text>
              <Button
                mode="outlined"
                onPress={() => {
                  refocusAt.current = -1;
                  onRemoveOwe();
                }}
                disabled={isBusy}
                style={styles.start}
              >
                {t("home.reconcile.compare.removeOwe", {
                  amount: money(oweTotal, currency),
                })}
              </Button>
            </View>
          )}
        </>
      )}

      {screen === "smallGap" && (
        <View style={card} testID="reconcile-small-gap">
          <Text variant="titleMedium" textBreakStrategy="balanced">
            {t("home.reconcile.compare.smallGapQuestion")}
          </Text>
          {/* A café paid 3.80 and noted 3.00, or the reverse: a sample, never masked. */}
          <Text variant="bodyMedium" style={muted}>
            {t("home.reconcile.compare.smallGapSample", {
              paid: plain(gap < 0 ? 3.8 : 3, currency),
              noted: plain(gap < 0 ? 3 : 3.8, currency),
            })}
          </Text>
        </View>
      )}

      {screen === "firstComparison" && (
        <View style={card} testID="reconcile-first-comparison">
          <Text
            variant="titleMedium"
            textBreakStrategy="balanced"
            style={TABULAR_DIGITS}
          >
            {t("home.reconcile.compare.firstQuestion", {
              amount: money(gap, currency),
            })}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            {t("home.reconcile.compare.firstExplanation")}
          </Text>
        </View>
      )}

      {screen === "salaryEarly" && (
        <View style={card} testID="reconcile-salary-early">
          <Text variant="titleMedium" textBreakStrategy="balanced">
            {t("home.reconcile.compare.salaryQuestion")}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            {t("home.reconcile.compare.salaryComeBack", {
              day: comparison.nextPayDay,
            })}
          </Text>
        </View>
      )}

      {/* A card left out of step 1 holds money the accounts do not show yet. */}
      {screen === "moreOnAccounts" && !hasOwe && (
        <View style={card} testID="reconcile-card-question">
          <Text variant="bodyMedium" textBreakStrategy="balanced">
            {t("home.reconcile.compare.cardQuestion")}
          </Text>
          <Button
            mode="outlined"
            onPress={onAddOwe}
            disabled={isBusy}
            style={styles.start}
            contentStyle={styles.target}
          >
            {t("home.reconcile.accounts.addOwe")}
          </Button>
        </View>
      )}

      {(screen === "largeGap" || screen === "moreOnAccounts") && (
        <View style={card} testID="reconcile-large-gap">
          <Text variant="titleMedium" textBreakStrategy="balanced">
            {t("home.reconcile.compare.largeGapQuestion", {
              amount: signed(gap, currency),
            })}
          </Text>
        </View>
      )}
    </>
  );
}

/** A saving among the rows: « dépenses » alone would leave it out (spec.md §4.2). */
function offersSaving(comparison: Comparison): boolean {
  return comparison.suggestions.some((row) => row.kind === "saving");
}

/** A large font puts an amount under its label, as iOS does at accessibility sizes. */
function useStacksAmounts(): boolean {
  return useWindowDimensions().fontScale >= ACCESSIBLE_FONT_SCALE;
}

function Figure({ label, amount }: { label: string; amount: string }) {
  const theme = useTheme();
  const stacks = useStacksAmounts();
  return (
    <View style={stacks ? styles.stacked : styles.figure}>
      <Text
        variant="bodyMedium"
        style={[
          { color: theme.colors.onSurfaceVariant },
          !stacks && styles.grow,
        ]}
      >
        {label}
      </Text>
      <Amount size="row" numberOfLines={1}>
        {amount}
      </Amount>
    </View>
  );
}

interface ReconcileCompareActionsProps {
  comparison: Comparison;
  currency: SupportedCurrency;
  isBusy: boolean;
  isRecording: boolean;
  isSavingState: boolean;
  /** [Terminer], « Laisser comme ça » and « Non, laisser comme ça »: completed, nothing written. */
  onLeave: () => void;
  /** « Aucune … ne correspond », or « Rien ne correspond » with a saving among the rows. */
  onDismiss: () => void;
  onRecord: () => void;
  /** « Oui, c'était déjà là ». */
  onKeep: () => void;
  /** « Voir les autres raisons » and « Non, autre chose ». */
  onShowReasons: () => void;
}

/** Step 2's footer: one main action per screen, then the way to leave it as is. */
export function ReconcileCompareActions({
  comparison,
  currency,
  isBusy,
  isRecording,
  isSavingState,
  onLeave,
  onDismiss,
  onRecord,
  onKeep,
  onShowReasons,
}: ReconcileCompareActionsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { gap, screen, note } = comparison;

  if (screen === "matched") {
    return (
      <Button mode="contained" onPress={onLeave} disabled={isBusy}>
        {t("home.reconcile.compare.finish")}
      </Button>
    );
  }
  const leave = (
    <Button mode="text" onPress={onLeave} disabled={isBusy}>
      {t(
        screen === "largeGap" || screen === "moreOnAccounts"
          ? "home.reconcile.compare.noLeaveAsIs"
          : "home.reconcile.compare.leaveAsIs",
      )}
    </Button>
  );
  const reasons = (
    <Button
      mode="outlined"
      onPress={onShowReasons}
      disabled={isBusy}
      contentStyle={styles.target}
    >
      {t(
        screen === "salaryEarly"
          ? "home.reconcile.compare.seeOtherReasons"
          : "home.reconcile.compare.somethingElse",
      )}
    </Button>
  );
  if (screen === "salaryEarly") {
    // Coming back on pay day is the answer: leaving is the main action, as on web and iOS.
    return (
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={onLeave}
          disabled={isBusy}
          contentStyle={styles.target}
        >
          {t("home.reconcile.compare.leaveAsIs")}
        </Button>
        {reasons}
      </View>
    );
  }
  if (screen === "firstComparison") {
    return (
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={onKeep}
          disabled={isBusy}
          loading={isSavingState}
          contentStyle={styles.target}
        >
          {t("home.reconcile.compare.alreadyThere")}
        </Button>
        <Text
          variant="bodySmall"
          style={[
            styles.note,
            styles.noteOverButton,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {t("home.reconcile.compare.availableUnchanged")}
        </Text>
        {reasons}
        {leave}
      </View>
    );
  }
  if (screen === "suggestions") {
    return (
      <View style={styles.actions}>
        <Button mode="outlined" onPress={onDismiss} disabled={isBusy}>
          {t(
            gap > 0
              ? "home.reconcile.compare.noIncomeMatches"
              : offersSaving(comparison)
                ? "home.reconcile.compare.nothingMatches"
                : "home.reconcile.compare.noExpenseMatches",
          )}
        </Button>
        {leave}
      </View>
    );
  }
  const kind = gap < 0 ? "Expense" : "Income";
  const availableNote = t("home.reconcile.compare.availableNote", {
    before: money(note.before, currency),
    after: money(note.after, currency),
  });
  return (
    <View style={styles.actions}>
      <AmountButton
        label={t(
          screen === "smallGap"
            ? `home.reconcile.compare.note${kind}`
            : `home.reconcile.compare.yesNote${kind}`,
          { amount: money(Math.abs(gap), currency) },
        )}
        onPress={onRecord}
        isDisabled={isBusy}
        isLoading={isRecording}
      />
      <Text
        variant="bodySmall"
        style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
        accessibilityLabel={availableNote}
        testID="reconcile-available-note"
      >
        {arrowed(availableNote, theme.fonts.bodySmall.fontSize)}
      </Text>
      {leave}
    </View>
  );
}

const ARROW = "→";

/**
 * « avant → après » in a note. Roboto has no arrow: the fallback font draws it
 * small and on the baseline, where the icon font's sits on the digits' middle.
 * The note keeps the text itself as its TalkBack label.
 */
export function arrowed(text: string, fontSize: number): ReactNode {
  const [before, ...after] = text.split(ARROW);
  if (after.length === 0) return text;
  return (
    <>
      {before}
      <MaterialCommunityIcons
        name="arrow-right"
        size={fontSize}
        allowFontScaling
      />
      {after.join(ARROW)}
    </>
  );
}

/** Not Paper's Button: its label is one line, and an amount comes last in it. */
export function AmountButton({
  label,
  onPress,
  isDisabled,
  isLoading = false,
  isOutlined = false,
}: {
  label: string;
  onPress: () => void;
  isDisabled: boolean;
  isLoading?: boolean;
  isOutlined?: boolean;
}) {
  const theme = useTheme();
  const ripple = useRipple();
  const ink = isDisabled
    ? theme.colors.onSurfaceDisabled
    : isOutlined
      ? theme.colors.primary
      : theme.colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onPress={onPress}
      android_ripple={ripple}
      style={[
        styles.record,
        isOutlined
          ? { borderWidth: 1, borderColor: theme.colors.outline }
          : {
              backgroundColor: isDisabled
                ? theme.colors.surfaceDisabled
                : theme.colors.primary,
            },
      ]}
    >
      {isLoading && <ActivityIndicator size={ICON_SIZE.sm} color={ink} />}
      <Text
        variant="labelLarge"
        textBreakStrategy="balanced"
        style={[styles.recordLabel, TABULAR_DIGITS, { color: ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACING.sm },
  loading: { paddingVertical: SPACING.xl },
  // Paper insets a text button's label by 12: pulled back by as much, it starts on the text's edge.
  start: { alignSelf: "flex-start" },
  link: { paddingHorizontal: SPACING.md },
  shrink: { flexShrink: 1 },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  list: { paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" },
  figure: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  figures: { alignItems: "flex-end" },
  stacked: { alignItems: "flex-start" },
  grow: { flex: 1 },
  struck: { textDecorationLine: "line-through" },
  found: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  mark: {
    alignSelf: "center",
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: SUGGESTION_MIN_HEIGHT,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  settles: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  actions: { gap: SPACING.xs },
  // Paper's button, with room for a second line.
  record: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    overflow: "hidden",
  },
  recordLabel: { flexShrink: 1, textAlign: "center" },
  tappable: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET,
  },
  end: { alignSelf: "flex-end" },
  target: { minHeight: TOUCH_TARGET },
  note: { textAlign: "center" },
  // Close to the button it explains, clear of the framed one under it.
  noteOverButton: { marginBottom: SPACING.sm },
});
