import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  CURRENCY_METADATA,
  type SupportedCurrency,
  type TransactionKind,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { HeroFigure, HeroProgress } from "@/core/ui/hero";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import { FormModal } from "@/core/ui/sheet";
import {
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TINT_ALPHA,
} from "@/core/ui/theme";
import { KIND_ICONS } from "@/core/ui/vocabulary";

import type {
  CurrentMonthViewModel,
  RealizedMetrics,
} from "../current-month-view-model";
import { ForecastSection } from "./forecast-section";

/** One dot per item up to this many; past it, a dot is too small to count. */
const CHECK_DOT_LIMIT = 50;
const CHECK_DOT_COLUMNS = 25;
const CHECK_DOT_BORDER = 2;
const PERCENT = 100;
const FLOW_BAR_HEIGHT = 12;
const BAR_HEIGHT = 6;
const PLAN_TICK_WIDTH = 2;
const TILE_DISC = 28;

interface RealizedBalanceSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  metrics: CurrentMonthViewModel["metrics"];
  realized: RealizedMetrics;
  currency: SupportedCurrency;
  /**
   * Offered only where the month is the one being lived: a past balance has no
   * bank account left to be held against.
   */
  onReconcile?: () => void;
}

/**
 * What the month has actually done, as against what it planned, then where the
 * coming months land. The forest card holds the balance the user can compare
 * against their bank app — the whole point of pointing operations. Mirrors
 * `RealizedBalanceSheet` on iOS.
 */
export function RealizedBalanceSheet({
  isVisible,
  onDismiss,
  metrics,
  realized,
  currency,
  onReconcile,
}: RealizedBalanceSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const muted = { color: theme.colors.onSurfaceVariant };
  const spent = realized.realizedSpending;
  const plannedSpending = metrics.totalExpenses - metrics.totalSavings;
  const pendingIncome = metrics.totalIncome - realized.realizedIncome;
  const amount = (value: number) => formatCompactCurrency(value, currency);

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t("home.realized.title")}
      footer={
        onReconcile === undefined ? undefined : (
          <Button mode="contained" icon="bank-outline" onPress={onReconcile}>
            {t("home.reconcile.title")}
          </Button>
        )
      }
    >
      <CheckedBalanceCard realized={realized} currency={currency} />

      <View style={styles.section}>
        <Text variant="titleLarge">{t("home.realized.plannedVsActual")}</Text>
        <KindTile
          kind="expense"
          title={t("home.realized.expense")}
          tint={financial.expense}
        >
          <View style={styles.amountRow}>
            <Amount size="hero" tone="expense" style={styles.shrink}>
              {amount(spent)}
            </Amount>
            <Text variant="bodySmall" style={muted}>
              {t("home.realized.ofPlanned", {
                amount: amount(plannedSpending),
              })}
            </Text>
          </View>
          <PlanBar
            actual={spent}
            planned={plannedSpending}
            tint={financial.expense}
            track={`${financial.expense}${TINT_ALPHA.icon}`}
            overrun={financial.overBudget}
            height={FLOW_BAR_HEIGHT}
          />
          {spent > plannedSpending ? (
            <Text variant="labelMedium" style={{ color: financial.overBudget }}>
              {t("home.realized.overPlan", {
                amount: amount(spent - plannedSpending),
              })}
            </Text>
          ) : (
            <Text variant="bodySmall" style={muted}>
              {t("home.realized.margin", {
                amount: amount(plannedSpending - spent),
              })}
            </Text>
          )}
        </KindTile>

        <View style={styles.tileRow}>
          <KindTile
            kind="income"
            title={t("home.realized.income")}
            tint={financial.income}
          >
            <Amount size="row" tone="income">
              {amount(realized.realizedIncome)}
            </Amount>
            <View style={styles.label}>
              <MaterialCommunityIcons
                name={pendingIncome > 0 ? "clock-outline" : "check"}
                size={ICON_SIZE.sm}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="bodySmall" style={[styles.shrink, muted]}>
                {pendingIncome > 0
                  ? t("home.realized.incomePending", {
                      amount: amount(pendingIncome),
                    })
                  : t("home.realized.incomeArrived")}
              </Text>
            </View>
          </KindTile>
          <KindTile
            kind="saving"
            title={t("home.realized.savings")}
            tint={financial.savings}
          >
            <Amount size="row" tone="savings">
              {amount(realized.realizedSavings)}
            </Amount>
            <PlanBar
              actual={realized.realizedSavings}
              planned={metrics.totalSavings}
              tint={financial.savings}
              track={theme.colors.surface}
              height={BAR_HEIGHT}
            />
            <Text variant="bodySmall" style={muted}>
              {t("home.realized.ofPlanned", {
                amount: amount(metrics.totalSavings),
              })}
            </Text>
          </KindTile>
        </View>
      </View>

      <ForecastSection currency={currency} />
    </FormModal>
  );
}

/** The pointed balance on the forest, and how much of the month is pointed: one dot per item. */
function CheckedBalanceCard({
  realized,
  currency,
}: {
  realized: RealizedMetrics;
  currency: SupportedCurrency;
}) {
  const { t } = useTranslation();
  const hero = useHeroColors();
  const checked = realized.checkedItemsCount;
  const total = realized.totalItemsCount;
  const share = total > 0 ? checked / total : 0;

  return (
    <LinearGradient
      colors={[hero.surfaceTop, hero.surface]}
      style={styles.heroCard}
    >
      <HeroFigure
        eyebrow={t("home.realized.checkedBalance")}
        amount={formatCompactAmount(realized.realizedBalance, currency)}
        currency={CURRENCY_METADATA[currency].symbol}
      />
      {/* The state lives in the sentence, never in the surface (The Two-Zone Rule). */}
      <Text variant="bodyMedium" style={{ color: hero.support }}>
        {realized.realizedBalance < 0 && (
          <Text style={[styles.bold, { color: hero.caution }]}>
            {`${t("home.realized.belowZero")} `}
          </Text>
        )}
        {t("home.realized.bankPromise")}
      </Text>

      {total > 0 && (
        <>
          {total > CHECK_DOT_LIMIT ? (
            <HeroProgress
              progress={share}
              label={`${Math.round(share * PERCENT)}%`}
            />
          ) : (
            <View
              style={styles.dots}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {Array.from({ length: total }, (_, index) => (
                <View key={index} style={styles.dotCell}>
                  <View
                    style={[
                      styles.dot,
                      index < checked
                        ? { backgroundColor: hero.positive }
                        : {
                            borderColor: hero.muted,
                            borderWidth: CHECK_DOT_BORDER,
                          },
                    ]}
                  />
                </View>
              ))}
            </View>
          )}
          <View style={styles.counts}>
            <Text
              variant="labelMedium"
              style={[TABULAR_DIGITS, { color: hero.support }]}
            >
              <Text style={styles.bold}>{checked}</Text>
              {` ${t("home.realized.checkedCount", { count: checked })}`}
            </Text>
            <Text
              variant="labelMedium"
              style={[TABULAR_DIGITS, { color: hero.support }]}
            >
              <Text style={styles.bold}>{total - checked}</Text>
              {` ${t("home.realized.toCheck")}`}
            </Text>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

/** A nature's tile: its glyph and name, then whatever the nature has to say. */
function KindTile({
  kind,
  title,
  tint,
  children,
}: {
  kind: TransactionKind;
  title: string;
  tint: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      style={[styles.tile, { backgroundColor: `${tint}${TINT_ALPHA.surface}` }]}
    >
      <View style={styles.label}>
        <View
          style={[styles.tileDisc, { backgroundColor: theme.colors.surface }]}
        >
          <MaterialCommunityIcons
            name={KIND_ICONS[kind]}
            size={ICON_SIZE.sm}
            color={tint}
          />
        </View>
        <Text variant="labelLarge">{title}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Actual against plan. Past the plan the whole track turns over-budget and the
 * fill shrinks to the plan's share of it, with a tick where the plan ends: the
 * two ambers alone are too close to tell apart in the dark.
 */
function PlanBar({
  actual,
  planned,
  tint,
  track,
  overrun,
  height,
}: {
  actual: number;
  planned: number;
  tint: string;
  track: string;
  overrun?: string;
  height: number;
}) {
  const theme = useTheme();
  const isOver = overrun !== undefined && actual > planned;
  const ratio = isOver ? planned / actual : planned > 0 ? actual / planned : 0;
  const fill = `${Math.min(Math.max(ratio, 0), 1) * PERCENT}%` as const;

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: isOver ? overrun : track },
      ]}
    >
      <View style={[styles.fill, { width: fill, backgroundColor: tint }]} />
      {isOver && (
        <View
          style={[
            styles.planTick,
            { left: fill, backgroundColor: theme.colors.onSurface },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  bold: { fontWeight: "700" },
  dots: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACING.xs },
  dotCell: {
    width: `${PERCENT / CHECK_DOT_COLUMNS}%`,
    aspectRatio: 1,
    padding: SPACING.xxs,
  },
  dot: { flex: 1, borderRadius: RADIUS.full },
  counts: { flexDirection: "row", justifyContent: "space-between" },
  section: { gap: SPACING.sm, marginTop: SPACING.sm },
  tileRow: { flexDirection: "row", gap: SPACING.sm },
  tile: {
    flex: 1,
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  tileDisc: {
    width: TILE_DISC,
    height: TILE_DISC,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  shrink: { flexShrink: 1 },
  track: {
    flexDirection: "row",
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.full },
  planTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: PLAN_TICK_WIDTH,
    marginLeft: -PLAN_TICK_WIDTH / 2,
  },
});
