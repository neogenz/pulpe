import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { BudgetDeletionImpact } from "pulpe-shared";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Menu,
  Portal,
  Text,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { FieldError } from "@/core/ui/field-error";
import { HeroAppBarAction } from "@/core/ui/hero";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { fetchBudgetDeletionImpact } from "@/features/budgets/budget-api";
import { budgetKeys } from "@/features/budgets/budget-queries";
import { useDeleteBudget } from "@/features/budgets/delete-budget-mutation";

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
}

/**
 * "Supprimer ce mois": a menu in the app bar, and a confirmation that first
 * reads what the deletion takes with it. The server refuses a linked month
 * unless told the links were seen, so the answer sent is the one the user was
 * shown.
 */
export function DeleteMonthAction({
  budgetId,
  monthTitle,
}: DeleteMonthActionProps) {
  const { t } = useTranslation();
  const financial = useFinancialColors();
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
          title={t(`${PREFIX}.action`)}
          onPress={() => {
            setMenuVisible(false);
            setDialogOpen(true);
          }}
        />
      </Menu>

      <Portal>
        <Dialog
          visible={isDialogOpen}
          onDismiss={dismiss}
          dismissable={!remove.isPending}
        >
          <Dialog.Title>
            {t(`${PREFIX}.title`, { month: monthTitle })}
          </Dialog.Title>
          <Dialog.Content>
            {impact.isPending && (
              <ActivityIndicator accessibilityLabel={t("common.loading")} />
            )}
            {impact.isSuccess && (
              <>
                <Text variant="bodyMedium">
                  {t(`${PREFIX}.body`, {
                    forecastCount: impact.data.forecastCount,
                    movementCount: impact.data.movementCount,
                  })}
                </Text>
                {labels.length > 0 && (
                  <Text variant="bodyMedium">
                    {t(`${PREFIX}.links`, { links: labels.join(", ") })}
                  </Text>
                )}
              </>
            )}
            {impact.isError && (
              <FieldError visible>{t(`${PREFIX}.loadError`)}</FieldError>
            )}
            {remove.isError && (
              <FieldError visible>{t(`${PREFIX}.failure`)}</FieldError>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={dismiss} disabled={remove.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              onPress={() =>
                remove.mutate(labels.length > 0, {
                  onSuccess: () => {
                    setDialogOpen(false);
                    router.back();
                  },
                })
              }
              textColor={financial.destructive}
              disabled={
                !impact.isSuccess || impact.isFetching || remove.isPending
              }
              loading={remove.isPending}
            >
              {t(`${PREFIX}.confirm`)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
