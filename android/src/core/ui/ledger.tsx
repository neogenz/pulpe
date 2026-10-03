import { Children, Fragment, isValidElement, type ReactNode } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useRipple } from "@/core/ui/ripple";
import { EMPHASIS, RADIUS, ROW, SPACING } from "@/core/ui/theme";

/** Between the disc, the text and the amount. */
const ROW_GAP = SPACING.sm + SPACING.xs;

interface LedgerCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Where the hairline between rows starts. Under the text column by default;
   * a list whose rows open on their name rather than a disc starts it there.
   */
  dividerInset?: number;
}

/**
 * The One Ledger Rule: every list is one card, its rows separated by hairlines
 * that start after the disc column — never a run of separate cards, which made
 * a month of twenty lines read as twenty unrelated objects. `pulpeRowCard()` on
 * iOS.
 */
export function LedgerCard({
  children,
  style,
  testID,
  dividerInset,
}: LedgerCardProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.dark ? theme.colors.outlineVariant : "transparent",
        },
        style,
      ]}
    >
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 && (
            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.outlineVariant },
                dividerInset !== undefined && { marginLeft: dividerInset },
              ]}
            />
          )}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

interface LedgerRowProps {
  /** A 36dp disc: what the row is, before the eye reaches the words. */
  leading?: ReactNode;
  title: string;
  /** One quiet line under the title. */
  subtitle?: ReactNode;
  /** The amount column. */
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Pointed: the title struck through, the row receding without fading. */
  isStruck?: boolean;
  /** Mid-request: the row steps back until the server answers. */
  isPending?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * A row that opens something says so the Android way: the whole row ripples
 * under the finger. No trailing chevron — that disclosure mark is UIKit's
 * table-view idiom, and a Material list leaves it out.
 */
export function LedgerRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  onLongPress,
  isStruck = false,
  isPending = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: LedgerRowProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const body = (
    <>
      {leading !== undefined && <View style={styles.leading}>{leading}</View>}
      <View style={styles.text}>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={[
            {
              color: isStruck
                ? theme.colors.onSurfaceVariant
                : theme.colors.onSurface,
            },
            isStruck && styles.struck,
          ]}
        >
          {title}
        </Text>
        {typeof subtitle === "string" ? (
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing !== undefined && (
        <View style={styles.trailing}>{trailing}</View>
      )}
    </>
  );

  if (onPress === undefined && onLongPress === undefined) {
    return (
      <View
        testID={testID}
        style={[styles.row, isPending && styles.pending]}
        accessible={accessibilityLabel !== undefined}
        accessibilityLabel={accessibilityLabel}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={ripple}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.row, isPending && styles.pending]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    // Under the text column, not the disc: the disc column runs uninterrupted.
    marginLeft: SPACING.md + ROW.disc + ROW_GAP,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: ROW.minHeight,
    paddingVertical: ROW_GAP,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.md,
  },
  leading: { width: ROW.disc, alignItems: "center" },
  text: { flex: 1, gap: SPACING.xxs },
  trailing: { alignItems: "flex-end", flexShrink: 0, maxWidth: "45%" },
  struck: { textDecorationLine: "line-through" },
  pending: { opacity: EMPHASIS.pending },
  segment: {
    marginHorizontal: SPACING.md,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  segmentFirst: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  segmentLast: {
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
  },
});

interface LedgerSegmentProps {
  children: ReactNode;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * One row's share of a ledger card, for a virtualized list that cannot wrap a
 * whole section in one view: the first segment carries the card's top corners,
 * the last its bottom ones, and every other one the hairline above it. Laid end
 * to end, they draw exactly the card `LedgerCard` draws in one piece.
 */
export function LedgerSegment({
  children,
  isFirst,
  isLast,
}: LedgerSegmentProps) {
  const theme = useTheme();
  const border = theme.dark ? theme.colors.outlineVariant : "transparent";

  return (
    <View
      style={[
        styles.segment,
        {
          backgroundColor: theme.colors.surface,
          borderColor: border,
          borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: isLast ? StyleSheet.hairlineWidth : 0,
        },
        isFirst && styles.segmentFirst,
        isLast && styles.segmentLast,
      ]}
    >
      {!isFirst && (
        <View
          style={[
            styles.divider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />
      )}
      {children}
    </View>
  );
}
