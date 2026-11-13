import { CURRENCY_METADATA } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatAmount, formatCompactCurrency } from "@/core/ui/amount-format";
import {
  HeroFigure,
  HeroTile,
  HeroTileRow,
  HeroVerdict,
  HeroZone,
} from "@/core/ui/hero";
import { useFinancialColors, useHeroColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";

import type { NetWorthSections } from "../net-worth-sections";

/**
 * Net worth as the dominant figure, with what I have and what I owe beside it.
 * A negative net reads in the warning ink, never an error red.
 */
export function NetWorthHero({ sections }: { sections: NetWorthSections }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const hero = useHeroColors();
  const financial = useFinancialColors();
  const { baseCurrency } = sections;
  const isNegative = sections.net < 0;

  const names = sections.unconverted.map((asset) => asset.name).join(", ");
  const currencies = [
    ...new Set(sections.unconverted.map((asset) => asset.currency)),
  ]
    .sort()
    .join(", ");

  return (
    <HeroZone>
      <HeroFigure
        eyebrow={t("netWorth.net")}
        amount={formatAmount(sections.net, baseCurrency)}
        currency={CURRENCY_METADATA[baseCurrency].symbol}
      />
      <HeroTileRow>
        <HeroTile
          label={t("netWorth.have")}
          value={formatCompactCurrency(sections.gross, baseCurrency)}
        />
        <HeroTile
          label={t("netWorth.owe")}
          value={formatCompactCurrency(sections.debtsTotal, baseCurrency)}
        />
      </HeroTileRow>
      <View style={styles.notes}>
        {isNegative && (
          <HeroVerdict
            sentence={t("netWorth.negativeNote")}
            tint={financial.overBudget}
          />
        )}
        {sections.hasForeignValues && (
          <Text variant="bodySmall" style={{ color: hero.support }}>
            {t("netWorth.foreignNote")}
          </Text>
        )}
        {sections.incomplete && sections.unconverted.length > 0 && (
          // Currencies and names only, never an amount.
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {t("netWorth.incompleteNote", { currencies, names })}
          </Text>
        )}
      </View>
    </HeroZone>
  );
}

const styles = StyleSheet.create({
  notes: { gap: SPACING.sm },
});
