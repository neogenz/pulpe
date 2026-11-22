import { ANALYTICS_EVENTS, type SupportedCurrency } from "pulpe-shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { StepDots } from "@/core/ui/step-dots";
import { ICON_SIZE, RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import { countAt } from "@/features/net-worth/net-worth-intro";

import { markReconcileGuideSeen } from "../reconcile-guide-gate";
import { plain } from "../reconciliation";
import {
  GUIDE_SAMPLE,
  GUIDE_SCENES,
  guideAction,
  guideGap,
  type GuideOutcome,
  type GuideScene,
  type GuideSource,
} from "../reconcile-guide";

/** Gap between two beats of a scene's animation. */
const BEAT_MS = 150;
const MOVE_MS = 450;
const COUNT_MS = 600;
const EASE_OUT = Easing.out(Easing.cubic);

interface ReconcileGuideOptions {
  /** `null` while the guide is not showing. */
  source: GuideSource | null;
  /** The budget's currency, for the sample figures. */
  currency: SupportedCurrency;
  /** Fires once per opening, whatever the exit; the parent then leaves the page. */
  onFinish: (outcome: GuideOutcome) => void;
}

/**
 * The guide is a page of the comparison sheet, not a second dialog: the sheet
 * keeps its own frame and swaps its body and footer for these. `skip` is every
 * exit but « Comparer maintenant » (« Passer », close, back, scrim).
 */
export function useReconcileGuidePage({
  source,
  currency,
  onFinish,
}: ReconcileGuideOptions) {
  const { t } = useTranslation();
  const theme = useTheme();
  const ground = useV2Colors().sunk;
  const [index, setIndex] = useState(0);
  const isFinished = useRef(false);

  useEffect(() => {
    if (source === null) return;
    isFinished.current = false;
    captureEvent(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED, {
      source,
    });
    // Unmounted or closed from outside (the vault locks) with no exit taken:
    // still counts as skipped, once, and the guide does not come back.
    return () => {
      if (isFinished.current) return;
      isFinished.current = true;
      captureEvent(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED, {
        source,
      });
      markReconcileGuideSeen();
    };
  }, [source]);

  if (source === null) return null;
  const eventSource: GuideSource = source;

  function finish(outcome: GuideOutcome) {
    if (isFinished.current) return;
    isFinished.current = true;
    captureEvent(
      outcome === "completed"
        ? ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED
        : ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED,
      { source: eventSource },
    );
    setIndex(0);
    onFinish(outcome);
  }

  const scene = GUIDE_SCENES[index];
  const action = guideAction(index);
  const base = "home.reconcile.guide";

  return {
    skip: () => finish("skipped"),
    // « Passer » on every scene, in the header like web and iOS.
    skipAction: (
      <Button
        mode="text"
        onPress={() => finish("skipped")}
        contentStyle={styles.buttonContent}
        testID="reconcile-guide-skip"
      >
        {t(`${base}.skip`)}
      </Button>
    ),
    body: (
      <>
        {/* Keyed by scene: a new scene mounts fresh and plays again. Sized to
            its drawing; the sheet, not the scene, keeps the footer still. */}
        <View
          key={scene}
          testID="reconcile-guide-scene"
          style={[styles.scene, { backgroundColor: ground }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Scene scene={scene} currency={currency} />
        </View>
        {/* Live: TalkBack keeps its focus on « Suivant », so it reads the new scene out. */}
        <View accessibilityLiveRegion="polite" style={styles.text}>
          <Text
            variant="headlineSmall"
            accessibilityRole="header"
            textBreakStrategy="balanced"
          >
            {t(`${base}.scenes.${scene}.title`)}
          </Text>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
            textBreakStrategy="balanced"
          >
            {t(`${base}.scenes.${scene}.body`)}
          </Text>
        </View>
      </>
    ),
    footer: (
      <>
        <StepDots
          count={GUIDE_SCENES.length}
          current={index}
          label={t(`${base}.stepOf`, {
            current: index + 1,
            total: GUIDE_SCENES.length,
          })}
        />
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() =>
              action === "next" ? setIndex(index + 1) : finish("completed")
            }
            style={styles.primary}
            contentStyle={styles.buttonContent}
            testID="reconcile-guide-primary"
          >
            {t(`${base}.${action === "next" ? "next" : "start"}`)}
          </Button>
        </View>
      </>
    ),
  };
}

// MARK: Motion

type BeatKind = "in" | "out" | "pop";

/**
 * One thing of a scene, on its beat: `in` grows in from below, `out` shrinks
 * away upwards, `pop` springs in. Reduce Motion starts every beat at its end.
 */
function Beat({
  at,
  kind = "in",
  style,
  children,
}: {
  at: number;
  kind?: BeatKind;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const isReduced = useReducedMotion();
  const progress = useSharedValue(isReduced ? 1 : 0);
  useEffect(() => {
    if (isReduced) return;
    progress.value = withDelay(
      at * BEAT_MS,
      kind === "pop"
        ? withSpring(1, { damping: 12 })
        : withTiming(1, { duration: MOVE_MS, easing: EASE_OUT }),
    );
  }, [at, kind, isReduced, progress]);
  // Transforms only (`EMPHASIS` owns opacity): a thing is scale 0 until its beat.
  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    const rest = kind === "out" ? p : 1 - p;
    return {
      transform: [
        { translateY: (kind === "out" ? -SPACING.sm : SPACING.sm) * rest },
        { scale: kind === "out" ? 1 - p : p },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Something answered on its beat: it folds away, height and all, so the end
 * state keeps no hole where it was. Reduce Motion never shows it.
 */
function Fold({ at, children }: { at: number; children: ReactNode }) {
  const isReduced = useReducedMotion();
  const height = useSharedValue<number | null>(null);
  const progress = useSharedValue(0);
  useEffect(() => {
    if (isReduced) return;
    progress.value = withDelay(
      at * BEAT_MS,
      withTiming(1, { duration: MOVE_MS, easing: EASE_OUT }),
    );
  }, [at, isReduced, progress]);
  const folding = useAnimatedStyle(() =>
    height.value === null
      ? {}
      : { height: height.value * (1 - progress.value) },
  );
  if (isReduced) return null;
  return (
    <Animated.View style={[styles.fold, folding]}>
      <View
        onLayout={(event) => {
          height.value ??= event.nativeEvent.layout.height;
        }}
      >
        <Beat at={at} kind="out">
          {children}
        </Beat>
      </View>
    </Animated.View>
  );
}

/** A number rolling from `from` to `to`, starting at beat `at`. */
function useCountUp(from: number, to: number, at: number) {
  const isReduced = useReducedMotion();
  const [value, setValue] = useState(isReduced ? to : from);
  useEffect(() => {
    if (isReduced) return;
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now + at * BEAT_MS;
      const progress = (now - start) / COUNT_MS;
      setValue(countAt(from, to, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, at, isReduced]);
  return value;
}

// MARK: Scenes

function Scene({
  scene,
  currency,
}: {
  scene: GuideScene;
  currency: SupportedCurrency;
}) {
  if (scene === "compare") return <CompareScene currency={currency} />;
  if (scene === "type") return <TypeScene currency={currency} />;
  return <CheckScene currency={currency} />;
}

/** The bank says 890, Pulpe 950: they differ, and by how much. */
function CompareScene({ currency }: { currency: SupportedCurrency }) {
  const { t } = useTranslation();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  const { bank, pulpe } = GUIDE_SAMPLE;
  return (
    <>
      <View style={styles.pair}>
        <Beat at={0} style={styles.grow}>
          <BankCard>
            <Text variant="labelMedium">
              {t("home.reconcile.guide.sample.checking")}
            </Text>
            <Amount size="row">{plain(bank, currency)}</Amount>
          </BankCard>
        </Beat>
        <Beat at={4} kind="pop">
          <View style={[styles.badge, { backgroundColor: v2.overWash }]}>
            <Text variant="titleMedium" style={{ color: financial.overBudget }}>
              ≠
            </Text>
          </View>
        </Beat>
        <Beat at={2} style={styles.grow}>
          <PulpeCard>
            <Text variant="labelMedium">
              {t("home.reconcile.guide.sample.checked")}
            </Text>
            <Amount size="row">{plain(pulpe, currency)}</Amount>
          </PulpeCard>
        </Beat>
      </View>
      <Beat at={6} style={styles.center}>
        <View style={[styles.chip, { backgroundColor: v2.overWash }]}>
          <Text variant="labelLarge" style={{ color: financial.overBudget }}>
            {t("home.reconcile.guide.sample.difference", {
              amount: String(guideGap(GUIDE_SAMPLE)),
            })}
          </Text>
        </View>
      </Beat>
    </>
  );
}

/** The bank balance is read, 8, 9, 0 are typed, « Comparer » is pressed. */
function TypeScene({ currency }: { currency: SupportedCurrency }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isReduced = useReducedMotion();
  const press = useSharedValue(1);
  useEffect(() => {
    if (isReduced) return;
    press.value = withDelay(
      BEAT_MS * 12,
      withSequence(
        withTiming(0.94, { duration: 120 }),
        withTiming(1, { duration: 180 }),
      ),
    );
  }, [isReduced, press]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));
  const digits = String(GUIDE_SAMPLE.bank).split("");
  return (
    <>
      <Beat at={0}>
        <BankCard>
          <Text variant="labelMedium">
            {t("home.reconcile.guide.sample.checking")}
          </Text>
          <View style={styles.circled}>
            <Amount size="row">{plain(GUIDE_SAMPLE.bank, currency)}</Amount>
            {/* The balance is circled before its digits are typed below. */}
            <Beat
              at={2}
              kind="pop"
              style={[
                styles.balanceRing,
                { borderColor: theme.colors.primary },
              ]}
            />
          </View>
        </BankCard>
      </Beat>
      <View style={styles.center}>
        <Icon
          source="arrow-down"
          size={ICON_SIZE.lg}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
      <Beat at={3}>
        <PulpeCard>
          <Text variant="labelMedium">
            {t("home.reconcile.guide.sample.onAccounts")}
          </Text>
          <View style={styles.typed}>
            {digits.map((digit, i) => (
              <Beat key={i} at={5 + i}>
                <Text variant="titleLarge" style={styles.digit}>
                  {digit}
                </Text>
              </Beat>
            ))}
          </View>
          <Animated.View
            style={[
              styles.compareButton,
              { backgroundColor: theme.colors.primary },
              pressStyle,
            ]}
          >
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onPrimary }}
            >
              {t("home.reconcile.guide.sample.compare")}
            </Text>
          </Animated.View>
        </PulpeCard>
      </Beat>
    </>
  );
}

/**
 * The bank's expense is found and checked, Pulpe goes from 950 to 890, both
 * sides agree: the question, the row it asks about, then the verdict it leads
 * to, in the order of web and iOS.
 */
function CheckScene({ currency }: { currency: SupportedCurrency }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const v2 = useV2Colors();
  const { bank, pulpe, expense } = GUIDE_SAMPLE;
  const pulpeFigure = useCountUp(pulpe, bank, 6);
  return (
    <PulpeCard>
      <View style={styles.checkList}>
        <View style={styles.figures}>
          <Text variant="bodyMedium" style={styles.grow}>
            {t("home.reconcile.guide.sample.onAccounts")}
          </Text>
          <Amount size="meta">{plain(bank, currency)}</Amount>
        </View>
        <View style={styles.figures} testID="reconcile-guide-pulpe-row">
          <Text variant="bodyMedium" style={styles.grow}>
            {t("home.reconcile.guide.sample.pulpeChecked")}
          </Text>
          <Amount size="meta">{plain(pulpeFigure, currency)}</Amount>
        </View>
        <Fold at={5}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
            textBreakStrategy="balanced"
          >
            {t("home.reconcile.guide.sample.question")}
          </Text>
        </Fold>
        {/* Same edges as the figures above: the ring hangs outside the row. */}
        <View style={styles.figures}>
          <View style={[styles.circle, { borderColor: v2.pointRing }]}>
            <Beat at={4} kind="pop" style={styles.circleFill}>
              <View
                style={[
                  styles.circleFill,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Icon
                  source="check"
                  size={ICON_SIZE.sm}
                  color={theme.colors.onPrimary}
                />
              </View>
            </Beat>
          </View>
          <Text variant="bodyMedium" style={styles.grow}>
            {t("home.reconcile.guide.sample.expense")}
          </Text>
          <Amount size="meta">{plain(expense, currency)}</Amount>
          <Beat
            at={6}
            kind="out"
            style={[styles.ring, { borderColor: financial.overBudget }]}
          />
        </View>
        <Beat
          at={11}
          style={[styles.matched, { backgroundColor: v2.accentWash }]}
        >
          <Icon source="check" size={ICON_SIZE.sm} color={v2.accentInk} />
          <Text variant="labelLarge" style={{ color: v2.accentInk }}>
            {t("home.reconcile.guide.sample.matched")}
          </Text>
        </Beat>
      </View>
    </PulpeCard>
  );
}

// MARK: Pieces

function BankCard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View
        style={[
          styles.cardHeader,
          { backgroundColor: theme.colors.inverseSurface },
        ]}
      >
        <Icon
          source="bank-outline"
          size={ICON_SIZE.sm}
          color={theme.colors.inverseOnSurface}
        />
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.inverseOnSurface }}
        >
          {t("home.reconcile.guide.sample.bank")}
        </Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function PulpeCard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.mark, { backgroundColor: theme.colors.primary }]}
        />
        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
          {t("home.reconcile.guide.sample.pulpe")}
        </Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    justifyContent: "center",
    gap: SPACING.sm,
  },
  pair: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  grow: { flex: 1 },
  center: { alignItems: "center" },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  cardBody: { padding: SPACING.sm, gap: SPACING.xxs },
  mark: { width: 12, height: 12, borderRadius: RADIUS.xs },
  badge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  text: { gap: SPACING.md },
  // Room above and below for the ring, clear of the account's name.
  circled: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  balanceRing: {
    position: "absolute",
    top: -SPACING.xs,
    bottom: -SPACING.xs,
    left: 0,
    right: 0,
    borderWidth: 2,
    borderRadius: RADIUS.full,
  },
  typed: { flexDirection: "row", minHeight: 32, alignItems: "center" },
  digit: { fontVariant: ["tabular-nums"], fontWeight: "700" },
  compareButton: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  checkList: { gap: SPACING.sm },
  figures: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  fold: { overflow: "hidden" },
  matched: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs,
  },
  ring: {
    position: "absolute",
    top: -SPACING.xs,
    bottom: -SPACING.xs,
    left: -SPACING.xs,
    right: -SPACING.xs,
    borderWidth: 2,
    borderRadius: RADIUS.sm,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    borderWidth: 2,
  },
  circleFill: {
    ...StyleSheet.absoluteFill,
    margin: -2,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  primary: { flex: 1 },
  buttonContent: { minHeight: TOUCH_TARGET },
});
