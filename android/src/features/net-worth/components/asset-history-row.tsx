import type { AssetHistoryEntry, SupportedCurrency } from "pulpe-shared";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { areAmountsHidden } from "@/core/ui/amount-visibility";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerRow } from "@/core/ui/ledger";

import { formatEntryDate, signedAmount } from "../net-worth-sections";

const NO_EFFECT = "—";

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface EntryText {
  title: string;
  date: string;
  amount: string;
  /** Set on a movement a later entry took over: it no longer counts. */
  legend: string | null;
}

/** What a history row says, in the order TalkBack reads it (CA18, as iOS). */
export function assetHistoryEntryText(
  entry: AssetHistoryEntry,
  currency: SupportedCurrency,
  locale: string,
  t: Translate,
): EntryText {
  const date = formatEntryDate(entry.at, locale);
  if (entry.type === "snapshot") {
    return {
      title: t("netWorth.detail.recorded"),
      date,
      amount: signedAmount(entry.value, currency, false),
      legend: null,
    };
  }
  return {
    title: entry.name,
    date,
    // No rate for a foreign element: the server could not convert the effect.
    amount:
      entry.effect === null
        ? NO_EFFECT
        : signedAmount(entry.effect, currency, true),
    legend:
      entry.supersededAt === null
        ? null
        : t("netWorth.detail.superseded", {
            date: formatEntryDate(entry.supersededAt, locale),
          }),
  };
}

/** As iOS: no amount is read while amounts are hidden, nor for an effect with no rate. */
export function assetHistoryEntryLabel(text: EntryText): string {
  const amount =
    areAmountsHidden() || text.amount === NO_EFFECT ? null : text.amount;
  return [text.title, text.date, amount, text.legend]
    .filter(Boolean)
    .join(", ");
}

/**
 * One entry of an element's history: a value I entered, or a checked movement
 * with what it moved, in the element's currency. A movement an entry took over
 * steps back and says so.
 */
export function AssetHistoryRow({
  entry,
  currency,
}: {
  entry: AssetHistoryEntry;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const text = assetHistoryEntryText(entry, currency, locale, t);
  const isSuperseded = text.legend !== null;
  const quiet = theme.colors.onSurfaceVariant;

  return (
    <LedgerRow
      leading={
        <IconDisc
          name={entry.type === "snapshot" ? "pencil-outline" : "check"}
          tint={isSuperseded ? quiet : theme.colors.primary}
        />
      }
      title={text.title}
      wrapsTitle
      subtitle={
        <View>
          <Text variant="bodyMedium" style={{ color: quiet }}>
            {text.date}
          </Text>
          {text.legend !== null && (
            <Text variant="bodySmall" style={{ color: quiet }}>
              {text.legend}
            </Text>
          )}
        </View>
      }
      trailing={
        <Amount size="row" tone={isSuperseded ? "muted" : "neutral"}>
          {text.amount}
        </Amount>
      }
      accessibilityLabel={assetHistoryEntryLabel(text)}
    />
  );
}
