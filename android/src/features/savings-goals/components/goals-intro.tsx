import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ProgressBar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { formatMonthName } from "@/core/ui/date-format";

/** What the preview pretends the user already saved, in their own currency. */
const SAMPLE_TARGET = 6000;
const SAMPLE_SAVED = 2250;
const SAMPLE_MONTHLY = 250;
const SAMPLE_MONTHS = [8, 9, 10, 11];
const SAMPLE_YEAR = 2027;

interface GoalsIntroProps {
  currency: SupportedCurrency;
  /** `true` when the final button was tapped, `false` on any skip. */
  onComplete: (isCreating: boolean) => void;
}

/**
 * The one-time introduction to the Objectifs tab, mirroring
 * `SavingsGoalsIntroCover`: two pages that *show* the feature — a goal as it
 * will look, then the months it turns into — rather than describing it.
 *
 * It occupies the tab instead of covering it. On iOS the equivalent is a
 * `fullScreenCover` because the list sits under a navigation stack; here the
 * tab is the whole screen already, and a modal over it would only add a
 * dismissal the user has no reason to want.
 */
export function GoalsIntro({ currency, onComplete }: GoalsIntroProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const isLastPage = page === 1;

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.skipRow}>
        {!isLastPage && (
          <Button
            mode="text"
            onPress={() => onComplete(false)}
            accessibilityLabel={t("goals.intro.skipAccessibility")}
          >
            {t("goals.intro.skip")}
          </Button>
        )}
      </View>

      <View style={styles.stage}>
        {isLastPage ? (
          <PlanPreview currency={currency} />
        ) : (
          <GoalPreview currency={currency} />
        )}

        <View style={styles.copy}>
          <Text variant="headlineSmall" style={styles.centered}>
            {isLastPage
              ? t("goals.intro.planTitle")
              : t("goals.intro.goalTitle")}
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
          >
            {isLastPage ? t("goals.intro.planBody") : t("goals.intro.goalBody")}
          </Text>
        </View>
      </View>

      <View
        style={styles.dots}
        accessibilityLabel={t("goals.intro.page", {
          current: page + 1,
          total: 2,
        })}
        accessible
      >
        {[0, 1].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === page && styles.dotActive,
              {
                backgroundColor:
                  index === page
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => (isLastPage ? onComplete(true) : setPage(1))}
        >
          {t(`goals.intro.${isLastPage ? "create" : "next"}`)}
        </Button>
        {isLastPage && (
          <Button mode="text" onPress={() => onComplete(false)}>
            {t("goals.intro.later")}
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

function GoalPreview({ currency }: { currency: SupportedCurrency }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card mode="contained" style={styles.preview}>
      <Card.Content style={styles.previewContent}>
        <Text variant="titleMedium">{t("goals.intro.sampleName")}</Text>
        {/* Compact like the real progress card this previews — a sample that
            prints centimes promises a card that never does. */}
        <Amount size="hero">
          {formatCompactCurrency(SAMPLE_SAVED, currency)}
        </Amount>
        <ProgressBar
          progress={SAMPLE_SAVED / SAMPLE_TARGET}
          style={styles.progress}
        />
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("goals.intro.sampleTarget", {
            amount: formatCompactCurrency(SAMPLE_TARGET, currency),
          })}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PlanPreview({ currency }: { currency: SupportedCurrency }) {
  const theme = useTheme();
  const { locale, t } = useTranslation();

  return (
    <Card mode="contained" style={styles.preview}>
      <Card.Content style={styles.previewContent}>
        {SAMPLE_MONTHS.map((month, index) => (
          <View key={month} style={styles.planRow}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {formatMonthName(month, SAMPLE_YEAR, locale)}
            </Text>
            <Amount size="row">
              {formatCurrency(SAMPLE_MONTHLY, currency)}
            </Amount>
            <Text
              variant="labelMedium"
              style={{
                color:
                  index === 0
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant,
              }}
            >
              {t(`goals.intro.${index === 0 ? "thisMonth" : "planned"}`)}
            </Text>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: SPACING.xl },
  skipRow: { flexDirection: "row", justifyContent: "flex-end" },
  stage: {
    flex: 1,
    justifyContent: "center",
    gap: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  preview: { borderRadius: RADIUS.md },
  previewContent: { gap: SPACING.sm },
  progress: { height: SPACING.sm, borderRadius: RADIUS.sm },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  copy: { gap: SPACING.sm },
  centered: { textAlign: "center" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
  },
  dot: { width: SPACING.sm, height: SPACING.sm, borderRadius: RADIUS.sm },
  dotActive: { width: SPACING.lg },
  actions: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
});
