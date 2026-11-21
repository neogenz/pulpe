import type { SupportedCurrency } from "pulpe-shared";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
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
import { RADIUS, SPACING, TABULAR_DIGITS, TOUCH_TARGET } from "@/core/ui/theme";

import { type Comparison, plain, type SuggestionRow } from "../reconciliation";

/** Above the app's 56dp rows: a suggestion carries a second line (spec.md §4.2). */
const SUGGESTION_MIN_HEIGHT = 64;

const DETAIL_KEYS = [
  "home.reconcile.compare.plannedThisMonth",
  "home.reconcile.compare.lastMonth",
  "home.reconcile.compare.twoMonthsAgo",
] as const;

/** An amount and its currency never part across two lines; a true minus, as on web and iOS. */
export function money(value: number, currency: SupportedCurrency): string {
  return formatCurrency(value, currency).replace(/ /g, " ").replace("-", "−");
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
}: ReconcileCompareStepProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const ripple = useRipple();
  const { locale, t } = useTranslation();
  const heading = useRef<View>(null);
  const rows = useRef<(View | null)[]>([]);
  // Where the checked row stood (-1: the title). It leaves, taking TalkBack's focus with it.
  const refocusAt = useRef<number | null>(null);
  const muted = { color: theme.colors.onSurfaceVariant };
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
            <Icon source="check" size={32} color={theme.colors.primary} />
          </View>
          <View style={card} testID="reconcile-matched">
            {matched.stillPlanned !== 0 && (
              <Figure
                label={t(
                  matched.stillPlanned < 0
                    ? "home.reconcile.compare.stillPlanned"
                    : "home.reconcile.compare.stillToReceive",
                )}
                amount={formatSignedCurrency(matched.stillPlanned, currency)}
              />
            )}
            {matched.beforePulpe !== 0 && (
              <Figure
                label={t("home.reconcile.compare.beforePulpe")}
                amount={formatSignedCurrency(matched.beforePulpe, currency)}
              />
            )}
            <View style={styles.figure}>
              <Text variant="titleSmall" style={styles.grow}>
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
            style={styles.figure}
            accessible
            accessibilityLabel={[
              t("home.reconcile.compare.inPulpe"),
              money(comparison.compared, currency),
              ...(comparison.comparedBefore === null
                ? []
                : [
                    t("home.reconcile.compare.instead", {
                      amount: money(comparison.comparedBefore, currency),
                    }),
                  ]),
            ].join(", ")}
            testID="reconcile-in-pulpe"
          >
            <Text variant="bodyMedium" style={[muted, styles.grow]}>
              {t("home.reconcile.compare.inPulpe")}
            </Text>
            <View style={styles.figures}>
              {comparison.comparedBefore !== null && (
                <View testID="reconcile-compared-before">
                  <Amount
                    size="meta"
                    numberOfLines={1}
                    style={[styles.struck, { color: v2.ink3 }]}
                  >
                    {money(comparison.comparedBefore, currency)}
                  </Amount>
                </View>
              )}
              <Amount size="row" numberOfLines={1}>
                {money(comparison.compared, currency)}
              </Amount>
            </View>
          </View>
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
                  : "home.reconcile.compare.leadExpense",
            )}
          </Text>
          <View style={[card, styles.list]}>
            {comparison.suggestions.map((row, index) => {
              const isChecking = checkingId === row.id;
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
                    size={24}
                    color={isChecking ? theme.colors.primary : v2.pointRing}
                  />
                  <View style={styles.grow}>
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text variant="bodySmall" style={muted}>
                      {row.monthsAgo === 0 && row.date !== null
                        ? formatDayMonth(new Date(row.date), locale)
                        : t(DETAIL_KEYS[row.monthsAgo])}
                    </Text>
                  </View>
                  <View
                    style={
                      row.settles && [
                        styles.settles,
                        { backgroundColor: v2.accentWash },
                      ]
                    }
                  >
                    <Amount size="row" numberOfLines={1}>
                      {money(row.amount, currency)}
                    </Amount>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {comparison.othersCount > 0 && (
            <Button
              mode="text"
              icon="arrow-right"
              onPress={onViewOthers}
              disabled={isBusy}
              style={styles.start}
              contentStyle={styles.link}
            >
              {t(
                comparison.othersCount === 1
                  ? "home.reconcile.compare.othersOne"
                  : "home.reconcile.compare.othersMany",
                { count: comparison.othersCount },
              )}
            </Button>
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

      {/* Phase 16 gives « plus sur tes comptes », « salaire en avance » and « première comparaison » their own screens. */}
      {screen !== "matched" &&
        screen !== "suggestions" &&
        screen !== "smallGap" && (
          <View style={card} testID="reconcile-large-gap">
            <Text variant="titleMedium" textBreakStrategy="balanced">
              {t("home.reconcile.compare.largeGapQuestion", {
                amount: formatSignedCurrency(gap, currency).replace(/ /g, " "),
              })}
            </Text>
          </View>
        )}
    </>
  );
}

function Figure({ label, amount }: { label: string; amount: string }) {
  const theme = useTheme();
  return (
    <View style={styles.figure}>
      <Text
        variant="bodyMedium"
        style={[{ color: theme.colors.onSurfaceVariant }, styles.grow]}
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
  /** [Terminer], « Laisser comme ça » and « Non, laisser comme ça »: completed, nothing written. */
  onLeave: () => void;
  /** « Aucune … ne correspond ». */
  onDismiss: () => void;
  onRecord: () => void;
}

/** Step 2's footer: one main action per screen, then the way to leave it as is. */
export function ReconcileCompareActions({
  comparison,
  currency,
  isBusy,
  isRecording,
  onLeave,
  onDismiss,
  onRecord,
}: ReconcileCompareActionsProps) {
  const theme = useTheme();
  const ripple = useRipple();
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
        screen === "suggestions" || screen === "smallGap"
          ? "home.reconcile.compare.leaveAsIs"
          : "home.reconcile.compare.noLeaveAsIs",
      )}
    </Button>
  );
  if (screen === "suggestions") {
    return (
      <View style={styles.actions}>
        <Button mode="outlined" onPress={onDismiss} disabled={isBusy}>
          {t(
            gap < 0
              ? "home.reconcile.compare.noExpenseMatches"
              : "home.reconcile.compare.noIncomeMatches",
          )}
        </Button>
        {leave}
      </View>
    );
  }
  const kind = gap < 0 ? "Expense" : "Income";
  const ink = isBusy ? theme.colors.onSurfaceDisabled : theme.colors.onPrimary;
  return (
    <View style={styles.actions}>
      {/* Not Paper's Button: its label is one line, and the amount comes last. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy, busy: isRecording }}
        disabled={isBusy}
        onPress={onRecord}
        android_ripple={ripple}
        style={[
          styles.record,
          {
            backgroundColor: isBusy
              ? theme.colors.surfaceDisabled
              : theme.colors.primary,
          },
        ]}
      >
        {isRecording && <ActivityIndicator size={18} color={ink} />}
        <Text
          variant="labelLarge"
          textBreakStrategy="balanced"
          style={[styles.recordLabel, TABULAR_DIGITS, { color: ink }]}
        >
          {t(
            screen === "smallGap"
              ? `home.reconcile.compare.note${kind}`
              : `home.reconcile.compare.yesNote${kind}`,
            { amount: money(Math.abs(gap), currency) },
          )}
        </Text>
      </Pressable>
      <Text
        variant="bodySmall"
        style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
        testID="reconcile-available-note"
      >
        {t("home.reconcile.compare.availableNote", {
          before: money(note.before, currency),
          after: money(note.after, currency),
        })}
      </Text>
      {leave}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACING.sm },
  loading: { paddingVertical: SPACING.xl },
  // Paper insets a text button's label by 12: pulled back by as much, it starts on the text's edge.
  start: { alignSelf: "flex-start" },
  link: { minHeight: TOUCH_TARGET },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  list: { paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" },
  figure: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  figures: { alignItems: "flex-end" },
  grow: { flex: 1 },
  struck: { textDecorationLine: "line-through" },
  found: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  mark: {
    alignSelf: "center",
    width: 64,
    height: 64,
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
  // Paper's contained button, with room for a second line.
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
  note: { textAlign: "center" },
});
