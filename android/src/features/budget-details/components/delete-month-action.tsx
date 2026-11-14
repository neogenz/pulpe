import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { BudgetDeletionImpact, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { View } from "react-native";
import { Menu, Text } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { HeroAppBarAction } from "@/core/ui/hero";
import { fetchBudgetDeletionImpact } from "@/features/budgets/budget-api";
import { budgetKeys } from "@/features/budgets/budget-queries";
import { useDeleteBudget } from "@/features/budgets/delete-budget-mutation";

import { elidesMonth } from "../month-period";
import { ImpactConfirmSheet } from "./impact-confirm-sheet";

type Translate = ReturnType<typeof useTranslation>["t"];

const PREFIX = "budgets.detail.deleteMonth";

/**
 * What the month is tied to, one phrase per kind that is present. The server
 * counts a forecast in a single category, and a withdrawal reaches the month
 * through its forecasts and its movements alike.
 */
function linkLabels({ links }: BudgetDeletionImpact, t: Translate): string[] {
  const counts: [number, string][] = [
    [links.spreadForecasts, "linkSpread"],
    [links.savingsGoalForecasts, "linkGoal"],
    [
      links.savingsWithdrawalForecasts + links.savingsWithdrawalMovements,
      "linkWithdrawal",
    ],
  ];
  return counts
    .filter(([count]) => count > 0)
    .map(([count, key]) => t(`${PREFIX}.${key}`, { count }));
}

interface DeleteMonthActionProps {
  budgetId: string;
  monthTitle: string;
  currency: SupportedCurrency;
  /** Only a month still to come can be deleted; otherwise the entry says why it cannot. */
  isAllowed: boolean;
  /** The month the disponible lives in: the one a deletion never touches. */
  liveMonthName: string;
}

/**
 * "Supprimer ce mois": a menu in the app bar, and a confirmation that first
 * reads what the deletion takes with it. The server refuses a linked month
 * unless told the links were seen, so the answer sent is the one the user was
 * shown. A month that cannot be deleted keeps its entry, disabled, with the
 * reason under it.
 */
export function DeleteMonthAction({
  budgetId,
  monthTitle,
  currency,
  isAllowed,
  liveMonthName,
}: DeleteMonthActionProps) {
  const { t } = useTranslation();
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const remove = useDeleteBudget(budgetId);
  const impact = useQuery({
    queryKey: [...budgetKeys.detail(budgetId), "deletion-impact"],
    queryFn: () => fetchBudgetDeletionImpact(budgetId),
    enabled: isDialogOpen,
    // A fresh read on every opening, and confirm waits for it: a stale one
    // could say "no links" for a month that has gained one since.
    gcTime: 0,
    staleTime: 0,
  });

  const labels = impact.isSuccess ? linkLabels(impact.data, t) : [];
  const message = impact.isSuccess
    ? [
        `${t(`${PREFIX}.forecasts`, { count: impact.data.forecastCount })} ${
          impact.data.movementCount === 0
            ? t(`${PREFIX}.movementsNone`)
            : t(`${PREFIX}.movements`, { count: impact.data.movementCount })
        }`,
        labels.length > 0
          ? t(`${PREFIX}.links`, { links: labels.join(", ") })
          : "",
      ]
        .filter((paragraph) => paragraph !== "")
        .join("\n")
    : undefined;

  function dismiss() {
    if (remove.isPending) return;
    remove.reset();
    setDialogOpen(false);
  }

  return (
    <>
      <Menu
        visible={isMenuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <HeroAppBarAction
            icon="dots-vertical"
            accessibilityLabel={t("common.moreOptions")}
            onPress={() => setMenuVisible(true)}
          />
        }
      >
        <Menu.Item
          leadingIcon="delete-outline"
          disabled={!isAllowed}
          title={
            isAllowed ? (
              t(`${PREFIX}.action`)
            ) : (
              <View>
                <Text variant="bodyLarge">{t(`${PREFIX}.action`)}</Text>
                <Text variant="bodySmall">{t(`${PREFIX}.onlyUpcoming`)}</Text>
              </View>
            )
          }
          onPress={() => {
            setMenuVisible(false);
            setDialogOpen(true);
          }}
        />
      </Menu>

      <ImpactConfirmSheet
        isVisible={isDialogOpen}
        onDismiss={dismiss}
        title={t(`${PREFIX}.title`, { month: monthTitle })}
        message={message}
        note={t(
          elidesMonth(liveMonthName)
            ? `${PREFIX}.finalityElided`
            : `${PREFIX}.finality`,
          { month: liveMonthName },
        )}
        currency={currency}
        isDestructive
        isLoading={impact.isPending}
        loadingLabel={t("common.loading")}
        confirmLabel={t(`${PREFIX}.confirm`, { month: monthTitle })}
        confirmDisabled={!impact.isSuccess || impact.isFetching}
        isBusy={remove.isPending}
        error={
          impact.isError
            ? t(`${PREFIX}.loadError`)
            : remove.isError
              ? t(`${PREFIX}.failure`)
              : null
        }
        onConfirm={() =>
          remove.mutate(labels.length > 0, {
            onSuccess: () => {
              setDialogOpen(false);
              // The stack can hold this month twice (rollover push, then
              // the pager's replace): popping one would land on the other.
              // The list says « Mois supprimé », as web and iOS do.
              router.dismissTo({
                pathname: "/budgets",
                params: { deletedMonth: "1" },
              });
            },
            // Links may have appeared since the read: confirm waits for
            // a fresh one, so the retry sends what the user is shown.
            onError: () => void impact.refetch(),
          })
        }
      />
    </>
  );
}
