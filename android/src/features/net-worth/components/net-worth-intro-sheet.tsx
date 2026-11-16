import { ANALYTICS_EVENTS, type SupportedCurrency } from "pulpe-shared";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTranslation } from "@/core/i18n/locale-store";
import { captureEvent } from "@/core/observability/analytics";
import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { Card } from "@/core/ui/card";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { FormModal } from "@/core/ui/sheet";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

import {
  countAt,
  INTRO_SAMPLE,
  INTRO_STEPS,
  introTotals,
  primaryAction,
  type IntroAction,
  type IntroSource,
  type IntroStep,
} from "../net-worth-intro";

export type IntroOutcome =
  | { kind: "completed"; action: Exclude<IntroAction, "next"> }
  | { kind: "skipped"; step: number };

interface NetWorthIntroSheetProps {
  source: IntroSource;
  isEmpty: boolean;
  currency: SupportedCurrency;
  /** Fires once per opening; the parent unmounts the sheet. */
  onFinish: (outcome: IntroOutcome) => void;
}

const TOTALS = introTotals(INTRO_SAMPLE);
/** Gap between two beats of a step's animation. */
const BEAT_MS = 150;
const MOVE_MS = 600;
const EASE_OUT = Easing.out(Easing.cubic);

/**
 * « Mon patrimoine » explainer: three steps, each an animated example card
 * above a short text, the step's title in the sheet's header. The close
 * button, the back action and the scrim all end it as skipped.
 */
export function NetWorthIntroSheet({
  source,
  isEmpty,
  currency,
  onFinish,
}: NetWorthIntroSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const isFinished = useRef(false);
  const action = primaryAction(step, isEmpty);
  const stepName = INTRO_STEPS[step];

  useEffect(() => {
    captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED, { source });
  }, [source]);

  function finish(outcome: IntroOutcome) {
    if (isFinished.current) return;
    isFinished.current = true;
    if (outcome.kind === "completed") {
      captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_COMPLETED, {
        source,
        action: outcome.action === "add" ? "add_asset" : "close",
      });
    } else {
      captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_SKIPPED, {
        source,
        step: outcome.step,
      });
    }
    onFinish(outcome);
  }

  function onPrimary() {
    if (action === "next") setStep(step + 1);
    else finish({ kind: "completed", action });
  }

  return (
    <FormModal
      isVisible
      title={t(`netWorth.intro.steps.${stepName}.title`)}
      onDismiss={() => finish({ kind: "skipped", step })}
      footer={
        <View style={styles.footer}>
          <StepDots current={step} />
          <Button
            mode="contained"
            onPress={onPrimary}
            testID="net-worth-intro-primary"
          >
            {t(`netWorth.intro.actions.${action}`)}
          </Button>
        </View>
      }
    >
      {/* Keyed by step: a new step mounts fresh and plays its animation again. */}
      <Card
        key={stepName}
        mode="contained"
        style={styles.scene}
        accessible
        accessibilityLabel={sceneLabel(stepName, currency, t)}
      >
        <Card.Content style={styles.sceneContent}>
          <View style={styles.sceneHeader}>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {stepName === "overview"
                ? t("netWorth.intro.sample.everything")
                : stepName === "update"
                  ? t("netWorth.net")
                  : ""}
            </Text>
            <ExampleChip />
          </View>
          {stepName === "overview" && <OverviewScene currency={currency} />}
          {stepName === "netWorth" && <NetWorthScene currency={currency} />}
          {stepName === "update" && <UpdateScene currency={currency} />}
        </Card.Content>
      </Card>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t(`netWorth.intro.steps.${stepName}.body`)}
      </Text>
    </FormModal>
  );
}

function sceneLabel(
  step: IntroStep,
  currency: SupportedCurrency,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const money = (value: number) => formatCompactCurrency(value, currency);
  return t(`netWorth.intro.steps.${step}.scene`, {
    gross: money(TOTALS.gross),
    debt: money(INTRO_SAMPLE.debt),
    net: money(TOTALS.netBefore),
    before: money(INTRO_SAMPLE.savingsBefore),
    after: money(INTRO_SAMPLE.savingsAfter),
    netAfter: money(TOTALS.netAfter),
  });
}

// MARK: Motion

/**
 * 0 → 1 once, after `delayMs`. Reduce Motion (`useReducedMotion`) starts at 1:
 * everything shows its end state at once, nothing moves.
 */
function useProgress(delayMs: number, spring = false) {
  const isReduced = useReducedMotion();
  const progress = useSharedValue(isReduced ? 1 : 0);
  useEffect(() => {
    if (isReduced) return;
    progress.value = withDelay(
      delayMs,
      spring
        ? withSpring(1, { damping: 12 })
        : withTiming(1, { duration: MOVE_MS, easing: EASE_OUT }),
    );
  }, [delayMs, isReduced, progress, spring]);
  return progress;
}

/** Fades in while sliding from an offset; transforms only, so the layout never moves. */
function useSlideIn(
  delayMs: number,
  dx = 0,
  dy: number = SPACING.md,
  tilt = 0,
) {
  const progress = useProgress(delayMs);
  return useAnimatedStyle(() => {
    const rest = 1 - progress.value;
    return {
      opacity: progress.value,
      transform: [
        { translateX: dx * rest },
        { translateY: dy * rest },
        { rotate: `${tilt * rest}deg` },
      ],
    };
  });
}

/** A number rolling from `from` to `to`, starting after `delayMs`. */
function useCountUp(
  from: number,
  to: number,
  delayMs: number,
  durationMs = 900,
) {
  const isReduced = useReducedMotion();
  const [value, setValue] = useState(isReduced ? to : from);
  useEffect(() => {
    if (isReduced) return;
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now + delayMs;
      const progress = (now - start) / durationMs;
      setValue(countAt(from, to, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, delayMs, durationMs, isReduced]);
  return value;
}

// MARK: Scenes

/** Four scattered things slide into one card, and the total rolls up to their sum. */
function OverviewScene({ currency }: { currency: SupportedCurrency }) {
  const total = useCountUp(0, TOTALS.gross, BEAT_MS * 4);
  return (
    <>
      <Amount size="hero">{formatCompactCurrency(total, currency)}</Amount>
      {INTRO_SAMPLE.assets.map((line, index) => (
        <ScatteredRow
          key={line.labelKey}
          index={index}
          {...line}
          currency={currency}
        />
      ))}
    </>
  );
}

function ScatteredRow({
  index,
  labelKey,
  icon,
  value,
  currency,
}: (typeof INTRO_SAMPLE.assets)[number] & {
  index: number;
  currency: SupportedCurrency;
}) {
  const { t } = useTranslation();
  const side = index % 2 === 0 ? -1 : 1;
  const style = useSlideIn(
    index * BEAT_MS,
    side * SPACING.xxl,
    (index < 2 ? -1 : 1) * SPACING.xxl,
    side * 8,
  );
  return (
    <Animated.View style={[styles.row, style]}>
      <SampleIcon icon={icon} />
      <Text variant="bodyLarge" style={styles.grow} numberOfLines={1}>
        {t(labelKey)}
      </Text>
      <Amount size="row">{formatCompactCurrency(value, currency)}</Amount>
    </Animated.View>
  );
}

/** What I have, what I owe eating into the bar, then the one figure left. */
function NetWorthScene({ currency }: { currency: SupportedCurrency }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const have = useSlideIn(0);
  const owe = useSlideIn(BEAT_MS);
  const bar = useProgress(BEAT_MS * 3);
  const debtShare = INTRO_SAMPLE.debt / TOTALS.gross;
  const debtStyle = useAnimatedStyle(() => ({
    width: `${bar.value * debtShare * 100}%`,
  }));
  const pop = useProgress(BEAT_MS * 6, true);
  const popStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.85 + 0.15 * pop.value }],
  }));
  const net = useCountUp(TOTALS.gross, TOTALS.netBefore, BEAT_MS * 6);

  return (
    <>
      <Animated.View style={[styles.row, have]}>
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
        <Text variant="bodyLarge" style={styles.grow}>
          {t("netWorth.have")}
        </Text>
        <Amount size="row">
          {formatCompactCurrency(TOTALS.gross, currency)}
        </Amount>
      </Animated.View>
      <Animated.View style={[styles.row, owe]}>
        <View style={[styles.dot, { backgroundColor: financial.overBudget }]} />
        <Text variant="bodyLarge" style={styles.grow} numberOfLines={1}>
          {t("netWorth.owe")}
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {` · ${t("netWorth.intro.sample.loan")}`}
          </Text>
        </Text>
        <Amount size="row" tone="overBudget">
          {`−${formatCompactCurrency(INTRO_SAMPLE.debt, currency)}`}
        </Amount>
      </Animated.View>
      <View style={[styles.bar, { backgroundColor: theme.colors.primary }]}>
        <Animated.View
          style={[
            styles.barDebt,
            { backgroundColor: financial.overBudget },
            debtStyle,
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.net,
          { backgroundColor: theme.colors.primary },
          popStyle,
        ]}
      >
        <Text variant="titleSmall" style={{ color: theme.colors.onPrimary }}>
          {t("netWorth.net")}
        </Text>
        <Text
          variant="headlineMedium"
          style={[styles.netAmount, { color: theme.colors.onPrimary }]}
        >
          {formatCompactCurrency(net, currency)}
        </Text>
      </Animated.View>
    </>
  );
}

/** The pencil is pressed, one value changes, the net worth follows; then the budget hint. */
function UpdateScene({ currency }: { currency: SupportedCurrency }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const v2 = useV2Colors();
  const isReduced = useReducedMotion();
  const savings = useCountUp(
    INTRO_SAMPLE.savingsBefore,
    INTRO_SAMPLE.savingsAfter,
    BEAT_MS * 7,
    500,
  );
  const net = useCountUp(TOTALS.netBefore, TOTALS.netAfter, BEAT_MS * 7, 500);
  const isUpdated = savings === INTRO_SAMPLE.savingsAfter;
  const press = useSharedValue(1);
  useEffect(() => {
    if (isReduced) return;
    press.value = withDelay(
      BEAT_MS * 5,
      withSequence(
        withTiming(0.88, { duration: 150 }),
        withTiming(1, { duration: 200 }),
      ),
    );
  }, [isReduced, press]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));
  const hint = useSlideIn(BEAT_MS * 12);

  return (
    <>
      <Amount size="hero">{formatCompactCurrency(net, currency)}</Amount>
      <View style={[styles.row, styles.updated, { backgroundColor: v2.sunk }]}>
        <SampleIcon icon="piggy-bank-outline" />
        <View style={styles.grow}>
          <Text variant="bodyLarge">{t("netWorth.intro.sample.savings")}</Text>
          <Text
            variant="bodySmall"
            style={{
              color: isUpdated ? v2.accentInk : theme.colors.onSurfaceVariant,
            }}
          >
            {t(
              isUpdated
                ? "netWorth.intro.updatedToday"
                : "netWorth.intro.updatedLongAgo",
            )}
          </Text>
        </View>
        <Amount size="row">{formatCompactCurrency(savings, currency)}</Amount>
        <Animated.View
          style={[
            styles.pencil,
            { backgroundColor: theme.colors.primary },
            pressStyle,
          ]}
        >
          <Icon
            source="pencil"
            size={ICON_SIZE.sm}
            color={theme.colors.onPrimary}
          />
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.hint, { borderColor: theme.colors.outline }, hint]}
      >
        <Icon source="swap-vertical" size={ICON_SIZE.sm} color={v2.accentInk} />
        <Text variant="bodyMedium" style={styles.grow}>
          {t("netWorth.intro.budgetHint", {
            amount: formatCompactCurrency(
              INTRO_SAMPLE.budgetSuggestion,
              currency,
            ),
          })}
        </Text>
      </Animated.View>
    </>
  );
}

// MARK: Pieces

function SampleIcon({ icon }: { icon: string }) {
  const v2 = useV2Colors();
  return (
    <View style={[styles.icon, { backgroundColor: v2.accentWash }]}>
      <Icon source={icon} size={ICON_SIZE.sm} color={v2.accentInk} />
    </View>
  );
}

function ExampleChip() {
  const { t } = useTranslation();
  const v2 = useV2Colors();
  return (
    <Text
      variant="labelMedium"
      style={[
        styles.chip,
        { backgroundColor: v2.accentWash, color: v2.accentInk },
      ]}
    >
      {t("netWorth.intro.example")}
    </Text>
  );
}

function StepDots({ current }: { current: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={t("netWorth.intro.stepOf", {
        current: current + 1,
        total: INTRO_STEPS.length,
      })}
    >
      {INTRO_STEPS.map((name, index) => (
        <View
          key={name}
          style={[
            styles.stepDot,
            index === current && styles.stepDotCurrent,
            {
              backgroundColor:
                index === current
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: SPACING.md },
  scene: { borderRadius: RADIUS.md },
  sceneContent: { gap: SPACING.sm },
  sceneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  chip: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  grow: { flex: 1 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: RADIUS.full },
  bar: {
    height: 12,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    marginVertical: SPACING.xs,
  },
  barDebt: { position: "absolute", top: 0, bottom: 0, right: 0 },
  net: { borderRadius: RADIUS.card, padding: SPACING.md, alignItems: "center" },
  netAmount: { fontVariant: ["tabular-nums"], fontWeight: "800" },
  updated: { borderRadius: RADIUS.card, padding: SPACING.sm },
  pencil: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.card,
    padding: SPACING.sm,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: RADIUS.full },
  stepDotCurrent: { width: 22 },
});
