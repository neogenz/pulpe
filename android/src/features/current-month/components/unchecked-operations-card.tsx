import type { SupportedCurrency, TransactionKind } from "pulpe-shared";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, View, type ViewStyle } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { IconDisc } from "@/core/ui/icon-disc";
import { hapticCommit, hapticSelection } from "@/core/ui/haptics";
import { Amount } from "@/core/ui/amount";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { EMPHASIS, RADIUS, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatDayMonth } from "@/core/ui/date-format";
import { KIND_ICONS, recurrenceLabel } from "@/core/ui/vocabulary";

import type { CheckableItem } from "../current-month-view-model";

const KIND_ACCENTS: Record<TransactionKind, "income" | "expense" | "savings"> =
  {
    income: "income",
    expense: "expense",
    saving: "savings",
  };

/** The sliver of canvas between two pages while one slides over the other. */
const PAGE_GAP = SPACING.sm;

interface UncheckedOperationsCardProps {
  items: CheckableItem[];
  currency: SupportedCurrency;
  /** Whether that operation's pointing is still on its way to the server. */
  isPending: (item: CheckableItem) => boolean;
  onToggle: (item: CheckableItem) => void;
  /** Opens the budget, where every operation of the month can be pointed. */
  onViewAll?: () => void;
}

/**
 * One operation at a time, with the two answers under it. A list of five with
 * five checkboxes is a chore; one question with "C'est passé" and "Plus tard"
 * is a habit — which is the whole point of pointing.
 *
 * The queue is a horizontal pager, Android's own way to hold one of several:
 * a swipe moves to the next operation, "Plus tard" slides there for the hand
 * that does not swipe, and each page says where it sits in the queue. Pointing
 * one takes it out, and the next slides into its place.
 */
export function UncheckedOperationsCard({
  items,
  currency,
  isPending,
  onToggle,
  onViewAll,
}: UncheckedOperationsCardProps) {
  const { t } = useTranslation();
  // A page is as wide as the frame it slides in, which is known only once the
  // frame has been laid out.
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const pager = useRef<FlatList<CheckableItem>>(null);

  if (items.length === 0) return null;

  const interval = (pageWidth ?? 0) + PAGE_GAP;

  function renderPage(
    item: CheckableItem,
    index: number,
    style: ViewStyle | undefined,
  ) {
    return (
      <OperationPage
        item={item}
        position={index + 1}
        count={items.length}
        currency={currency}
        isPending={isPending(item)}
        style={style}
        onConfirm={() => {
          // `commit`, not `success`: nothing has succeeded yet. The buzz that
          // says the app kept what was asked of it belongs to the mutation's
          // answer.
          hapticCommit();
          onToggle(item);
        }}
        onLater={items.length > 1 ? () => showLater(index) : undefined}
      />
    );
  }

  function showLater(index: number) {
    hapticSelection();
    // Past the last one, the queue starts over rather than running out.
    const next = (index + 1) % items.length;
    pager.current?.scrollToOffset({ offset: next * interval, animated: true });
  }

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("home.checking.title")}
        count={items.length}
        link={
          onViewAll === undefined
            ? undefined
            : { label: t("home.activity.viewAll"), onPress: onViewAll }
        }
      />

      <View
        testID="unchecked-pager-frame"
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          if (width > 0 && width !== pageWidth) setPageWidth(width);
        }}
      >
        {pageWidth === null ? (
          // Until then the first page stands alone at the frame's width, so the
          // section has its height from the first frame on.
          renderPage(items[0], 0, undefined)
        ) : (
          <FlatList
            ref={pager}
            testID="unchecked-pager"
            horizontal
            data={items}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={interval}
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={(_, index) => ({
              length: interval,
              offset: interval * index,
              index,
            })}
            renderItem={({ item, index }) =>
              renderPage(item, index, {
                width: pageWidth,
                marginRight: index === items.length - 1 ? 0 : PAGE_GAP,
              })
            }
          />
        )}
      </View>
    </View>
  );
}

function OperationPage({
  item,
  position,
  count,
  currency,
  isPending,
  style,
  onConfirm,
  onLater,
}: {
  item: CheckableItem;
  position: number;
  count: number;
  currency: SupportedCurrency;
  isPending: boolean;
  style: ViewStyle | undefined;
  onConfirm: () => void;
  onLater?: () => void;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const { locale, t } = useTranslation();
  const accent = financial[KIND_ACCENTS[item.kind]];

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.surface }, style]}
    >
      <View style={styles.operation}>
        <IconDisc name={KIND_ICONS[item.kind]} tint={accent} />

        <View style={styles.labels}>
          <Text variant="titleMedium" numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {item.subtitle.kind === "date"
              ? formatDayMonth(new Date(item.subtitle.value), locale)
              : recurrenceLabel(t, item.subtitle.value)}
          </Text>
        </View>

        <Amount size="row" numberOfLines={1}>
          {formatCompactCurrency(item.amount, currency)}
        </Amount>
      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: theme.colors.outlineVariant },
        ]}
      />

      {/* The wait is worn by the controls, not by the card: the operation
          someone is being asked about has to stay readable while the answer
          is in flight. Both buttons are `disabled` anyway, which is the state
          opacity is allowed to express. */}
      <View style={[styles.actions, isPending && styles.syncing]}>
        <Button
          mode="contained"
          icon="check"
          disabled={isPending}
          onPress={onConfirm}
          accessibilityLabel={t("home.checking.confirmAccessibility", {
            name: item.name,
          })}
        >
          {t("home.checking.confirm")}
        </Button>
        {onLater !== undefined && (
          <Button
            mode="text"
            disabled={isPending}
            onPress={onLater}
            accessibilityLabel={t("home.checking.laterAccessibility", {
              name: item.name,
            })}
          >
            {t("home.checking.later")}
          </Button>
        )}
        <Text
          variant="labelLarge"
          style={[styles.position, { color: theme.colors.onSurfaceVariant }]}
        >
          {`${position} / ${count}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm + SPACING.xs },
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.sm + SPACING.xs,
  },
  syncing: { opacity: EMPHASIS.pending },
  operation: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  labels: { flex: 1, gap: SPACING.xxs },
  divider: { height: StyleSheet.hairlineWidth },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  position: { marginLeft: "auto" },
});
