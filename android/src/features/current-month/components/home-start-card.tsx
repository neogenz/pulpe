import { StyleSheet, View } from "react-native";

import { useTranslation } from "@/core/i18n/locale-store";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";

import { startSubtitle } from "../home-presentation";

interface HomeStartCardProps {
  /** The first names waiting to be pointed, in the order the home lists them. */
  uncheckedNames: string[];
  uncheckedCount: number;
  onAddFirstExpense: () => void;
  onPoint: () => void;
}

/**
 * « Pour bien démarrer »: the two gestures of a first month, in place of
 * « À faire ». Add a first expense, then point what already went through the
 * account. `HomeStartCard` on iOS.
 */
export function HomeStartCard({
  uncheckedNames,
  uncheckedCount,
  onAddFirstExpense,
  onPoint,
}: HomeStartCardProps) {
  const { t } = useTranslation();
  const financial = useFinancialColors();

  return (
    <View style={styles.section}>
      <SectionHeader title={t("home.start.title")} />
      <LedgerCard testID="home-start-card">
        <LedgerRow
          testID="home-start-add"
          leading={<IconDisc name="plus" tint={financial.expense} />}
          title={t("home.start.addTitle")}
          subtitle={t("home.start.addHint")}
          onPress={onAddFirstExpense}
        />
        {uncheckedCount > 0 ? (
          <LedgerRow
            testID="home-start-point"
            leading={
              <IconDisc name="check-circle-outline" tint={financial.income} />
            }
            title={t("home.start.pointTitle")}
            subtitle={startSubtitle(t, uncheckedNames, uncheckedCount)}
            onPress={onPoint}
          />
        ) : null}
      </LedgerCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm + SPACING.xs },
});
