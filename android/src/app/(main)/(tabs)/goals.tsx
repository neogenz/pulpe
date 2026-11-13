import type {
  SavingsGoal,
  SavingsGoalProgress,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePushOnce } from "@/core/navigation/push-once";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { StateChip } from "@/core/ui/state-chip";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatAmount, formatCurrency } from "@/core/ui/amount-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { TabHeader } from "@/core/ui/tab-header";
import { useRipple } from "@/core/ui/ripple";
import {
  FAB_CLEARANCE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";
import { ActionButton } from "@/core/ui/action-button";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalsIntro } from "@/features/savings-goals/components/goals-intro";
import {
  hasSeenGoalsIntro,
  markGoalsIntroSeen,
} from "@/features/savings-goals/goals-intro-gate";
import { GoalProgressTrack } from "@/features/savings-goals/components/goal-progress-track";
import { goalRowFact } from "@/features/savings-goals/goal-presentation";
import { confirmedFraction } from "@/features/savings-goals/goals-vm";
import {
  useSavingsGoals,
  useSavingsGoalsProgress,
} from "@/features/savings-goals/goals-queries";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

export default function GoalsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useUserSettings();
  const goals = useSavingsGoals();
  const progressById = useSavingsGoalsProgress(goals.data ?? []);
  const pull = usePullToRefresh(() => goals.refetch());
  // Read once, at mount: the flag is written the moment the intro is answered,
  // and re-reading it mid-render would make the intro vanish under the user.
  const [isIntroVisible, setIntroVisible] = useState(
    () => !hasSeenGoalsIntro(),
  );
  const [isCreating, setCreating] = useState(false);
  // The « Pour commencer » preset the form opens with.
  const [presetName, setPresetName] = useState<string | undefined>();

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (goals.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  const header = <TabHeader title={t("goals.list.title")} />;
  const create = (name?: string) => {
    setPresetName(name);
    setCreating(true);
  };

  if (
    (goals.isError && goals.data === undefined) ||
    (settings.isError && settings.data === undefined)
  ) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <PlaceholderScreen
          icon="cloud-off-outline"
          title={t("goals.list.loadErrorTitle")}
          hint={t("common.loadErrorHint")}
          action={{
            label: t("common.retry"),
            onPress: () =>
              void Promise.all([goals.refetch(), settings.refetch()]),
          }}
        />
      </View>
    );
  }

  if (isIntroVisible) {
    return (
      <GoalsIntro
        currency={currency}
        onComplete={(shouldCreate) => {
          markGoalsIntroSeen();
          setIntroVisible(false);
          setCreating(shouldCreate);
        }}
      />
    );
  }

  const list = goals.data ?? [];
  const sections = STATUS_ORDER.map((status) => ({
    status,
    goals: list.filter((goal) => goal.status === status),
  })).filter((section) => section.goals.length > 0);
  const total = Object.values(progressById).reduce(
    (sum, progress) => sum + progress.confirmed,
    0,
  );

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {header}
      {list.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.empty}>
            <Text variant="titleLarge">{t("goals.list.emptyTitle")}</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("goals.list.emptyHint")}
            </Text>
            <ActionButton variant="primary" onPress={() => create()}>
              {t("goals.list.create")}
            </ActionButton>
          </View>
          <Starters onPick={create} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl {...pull} />}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("goals.list.subtitle")}
          </Text>
          <TotalCard total={total} count={list.length} currency={currency} />
          {sections.map((section) => (
            <View key={section.status} style={styles.section}>
              <SectionHeader
                title={t(`goals.list.sections.${section.status}`)}
              />
              <LedgerCard>
                {section.goals.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    progress={progressById[goal.id]}
                    currency={currency}
                  />
                ))}
              </LedgerCard>
            </View>
          ))}
        </ScrollView>
      )}

      {/* The empty state names the action itself; once there is a list, the
          plus sign carries it. */}
      {list.length > 0 && (
        <FAB
          testID="goals-create"
          icon="plus"
          style={styles.fab}
          onPress={() => create()}
          accessibilityLabel={t("goals.list.addAccessibility")}
        />
      )}

      <GoalFormSheet
        key={presetName ?? "blank"}
        isVisible={isCreating}
        onDismiss={() => setCreating(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        initialName={presetName}
        onSaved={() => setCreating(false)}
      />
    </View>
  );
}

const STATUS_ORDER: SavingsGoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

/** « Mis de côté pour tes objectifs »: the confirmed total over every goal. */
function TotalCard({
  total,
  count,
  currency,
}: {
  total: number;
  count: number;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.total, { backgroundColor: theme.colors.surface }]}>
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("goals.list.total")}
      </Text>
      <Amount size="hero">{formatCurrency(total, currency)}</Amount>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("goals.list.count", { count })}
      </Text>
    </View>
  );
}

/**
 * A goal as a row: name and what is confirmed, the bar, then one fact and the
 * target it aims at (`SavingsGoalRow` on iOS).
 */
function GoalRow({
  goal,
  progress,
  currency,
}: {
  goal: SavingsGoal;
  progress: SavingsGoalProgress | undefined;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const ripple = useRipple();
  const push = usePushOnce();
  const { locale, t } = useTranslation();
  const fact = goalRowFact(goal, progress, { t, locale, currency });
  const fraction = progress === undefined ? null : confirmedFraction(progress);

  return (
    <Pressable
      testID={`goal-row-${goal.id}`}
      android_ripple={ripple}
      accessibilityRole="button"
      onPress={() => push(`/goal/${goal.id}`)}
      style={styles.row}
    >
      <View style={styles.rowLine}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.rowName}>
          {goal.name}
        </Text>
        {progress !== undefined && (
          <Amount size="row" numberOfLines={1}>
            {formatAmount(progress.confirmed, currency)}
          </Amount>
        )}
      </View>
      {fraction !== null && (
        <GoalProgressTrack
          fraction={fraction}
          isMuted={goal.status === "PAUSED"}
        />
      )}
      <View style={[styles.rowLine, styles.rowFooter]}>
        <View style={styles.fact}>
          {fact.chip !== null && (
            <StateChip tint={theme.colors.onSurfaceVariant}>
              {fact.chip}
            </StateChip>
          )}
          {fact.text !== null && (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {fact.text}
            </Text>
          )}
        </View>
        {goal.targetAmount !== null && (
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("goals.list.ofTarget", {
              amount: formatCurrency(goal.targetAmount, currency),
            })}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** « Pour commencer »: three starting points; each opens the form with its name. */
function Starters({ onPick }: { onPick: (name: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const starters = [
    ["cushion", "cushionHint"],
    ["trip", "tripHint"],
    ["purchase", "purchaseHint"],
  ] as const;

  return (
    <View style={styles.section}>
      <SectionHeader title={t("goals.list.starter.title")} />
      <LedgerCard>
        {starters.map(([name, hint]) => (
          <LedgerRow
            key={name}
            title={t(`goals.list.starter.${name}`)}
            subtitle={t(`goals.list.starter.${hint}`)}
            onPress={() => onPick(t(`goals.list.starter.${name}`))}
          />
        ))}
      </LedgerCard>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("goals.list.starter.note")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.lg,
    paddingBottom: FAB_CLEARANCE,
  },
  section: { gap: SPACING.sm },
  empty: { gap: SPACING.sm },
  total: { borderRadius: RADIUS.card, padding: SPACING.lg, gap: SPACING.xs },
  row: { padding: SPACING.md, gap: SPACING.sm },
  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  rowName: { flexShrink: 1 },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  // The target drops under the fact rather than truncating it on a narrow row.
  rowFooter: { flexWrap: "wrap", rowGap: SPACING.xxs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
