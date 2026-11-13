import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";

import { ringGeometry } from "../budget-ring-segments";

const RING_SIZE = 216;
const STROKE = 18;
const SEGMENT_GAP = 6;
const OVERRUN_STROKE = 5;
const OVERRUN_OFFSET = 8;
const FULL_TURN = 360;
const TOP = -90;
/** Half of what separates two segments, as a fraction of the ring: the round caps reach half a stroke past each end. */
const CAP_INSET = (STROKE + SEGMENT_GAP) / 2 / (Math.PI * RING_SIZE);

function arcPath(centre: number, radius: number, from: number, to: number) {
  if (to <= from) return null;
  const path = Skia.Path.Make();
  path.addArc(
    {
      x: centre - radius,
      y: centre - radius,
      width: radius * 2,
      height: radius * 2,
    },
    TOP + from * FULL_TURN,
    (to - from) * FULL_TURN,
  );
  return path;
}

/**
 * What is left of the income once the charges and the savings are taken, with
 * an overrun as a coral arc around it. The same ring the welcome sample and the
 * preview draw, from `OnboardingBudgetRing.swift`.
 */
export function OnboardingBudgetRing({
  income,
  charges,
  savings,
  currency,
  subtitle,
}: {
  income: number;
  charges: number;
  savings: number;
  currency: SupportedCurrency;
  subtitle?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const financial = useFinancialColors();
  const v2 = useV2Colors();

  const geometry = ringGeometry(income, charges, savings);
  const available = income - charges - savings;
  const isOverrun = available < 0;
  const canvas = RING_SIZE + (OVERRUN_OFFSET + OVERRUN_STROKE) * 2;
  const centre = canvas / 2;
  const radius = (RING_SIZE - STROKE) / 2;
  const inset =
    [geometry.charges, geometry.savings, geometry.rest].filter(
      (segment) => segment.end - segment.start > 2 * CAP_INSET,
    ).length > 1
      ? CAP_INSET
      : 0;

  const segments = [
    { arc: geometry.charges, color: financial.expense },
    { arc: geometry.savings, color: financial.savings },
    { arc: geometry.rest, color: theme.colors.onSurface },
  ];
  const label = t(
    isOverrun ? "onboarding.ring.missing" : "onboarding.ring.available",
  );
  const amount = formatCurrency(Math.abs(available), currency);

  return (
    <View
      style={{ width: canvas, height: canvas }}
      accessible
      accessibilityLabel={`${label}, ${amount}`}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {segments.map(({ arc: span, color }, index) => {
          const path = arcPath(
            centre,
            radius,
            span.start + inset,
            span.end - inset,
          );
          return path === null ? null : (
            <Path
              key={index}
              path={path}
              style="stroke"
              strokeWidth={STROKE}
              strokeCap="round"
              color={color}
            />
          );
        })}
        {isOverrun && (
          <Path
            path={
              arcPath(
                centre,
                RING_SIZE / 2 + OVERRUN_OFFSET,
                0,
                Math.min(1, geometry.overrun),
              ) ?? Skia.Path.Make()
            }
            style="stroke"
            strokeWidth={OVERRUN_STROKE}
            strokeCap="round"
            color={v2.coral}
          />
        )}
      </Canvas>
      <View style={styles.centre} pointerEvents="none">
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {label}
        </Text>
        <Amount size="row" numberOfLines={1}>
          {amount}
        </Amount>
        <Text variant="bodySmall" style={{ color: v2.ink3 }}>
          {subtitle ?? currency}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: STROKE * 2,
  },
});
