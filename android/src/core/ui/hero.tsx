import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { useHeroColors } from "@/core/ui/scheme-colors";
import {
  BRAND_TYPE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

/**
 * The Two-Zone Rule, Android side. A screen with a dominant financial state
 * opens on the forest (`HeroZone`) and the content rises over it on the canvas
 * (`ContentZone`), whose rounded top is what marks where reading starts. The
 * curve belongs to the content, never to the forest — the same split iOS draws
 * with `heroZone()` / `contentZone()`.
 *
 * The app bar is forest too and stays put while the hero scrolls under it, the
 * way a Material top app bar holds its colour: the month and the account live
 * in the bar, not in a header rebuilt inside the scroll.
 */

const HERO_ICON_SLOP = 8;

interface HeroAppBarProps {
  title: string;
  /** Present on a pushed screen; a tab has nowhere to go back to. */
  onBack?: () => void;
  /** `HeroAppBarAction`s, trailing. */
  children?: ReactNode;
}

export function HeroAppBar({ title, onBack, children }: HeroAppBarProps) {
  const hero = useHeroColors();
  const { t } = useTranslation();

  return (
    <Appbar.Header
      mode="small"
      elevated={false}
      style={{ backgroundColor: hero.surfaceTop }}
    >
      {onBack !== undefined && (
        <Appbar.BackAction
          color={hero.ink}
          onPress={onBack}
          accessibilityLabel={t("common.back")}
        />
      )}
      <Appbar.Content title={title} color={hero.ink} />
      {children}
    </Appbar.Header>
  );
}

export function HeroAppBarAction(
  props: Omit<ComponentProps<typeof Appbar.Action>, "color">,
) {
  const hero = useHeroColors();
  return <Appbar.Action {...props} color={hero.ink} />;
}

interface ZoneProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * The forest a hero sits on: a two-stop gradient whose top stop is the app
 * bar's own colour, so the bar and the hero read as one surface.
 */
export function HeroZone({ children, style }: ZoneProps) {
  const hero = useHeroColors();

  return (
    <LinearGradient
      colors={[hero.surfaceTop, hero.surface]}
      style={[styles.heroZone, style]}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * The canvas the content reads on, rising over the hero by its own corner
 * radius. It grows to the bottom of the scroll, so a short list never shows the
 * forest underneath it.
 */
export function ContentZone({ children, style, onLayout }: ZoneProps) {
  const theme = useTheme();

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.contentZone,
        { backgroundColor: theme.colors.background },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface HeroFigureProps {
  eyebrow: string;
  /** Already formatted, without its currency. */
  amount: string;
  /** The currency code or symbol, set beside the figure on its baseline. */
  currency?: string;
  /** What the figure is measured against — `sur 10’000 CHF`. */
  suffix?: string;
  accessibilityLabel?: string;
}

/**
 * The hero's figure: a small label over one large number, the currency set
 * smaller beside it on the same line so the number dominates.
 */
export function HeroFigure({
  eyebrow,
  amount,
  currency,
  suffix,
  accessibilityLabel,
}: HeroFigureProps) {
  const hero = useHeroColors();

  return (
    <View
      style={styles.figure}
      accessible
      accessibilityLabel={
        accessibilityLabel ??
        [eyebrow, amount, currency, suffix].filter(Boolean).join(" ")
      }
    >
      <Text variant="labelLarge" style={{ color: hero.support }}>
        {eyebrow}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[BRAND_TYPE.heroFigure, TABULAR_DIGITS, { color: hero.ink }]}
      >
        {amount}
        {currency !== undefined && (
          <Text style={[BRAND_TYPE.heroCurrency, { color: hero.support }]}>
            {` ${currency}`}
          </Text>
        )}
        {suffix !== undefined && (
          <Text variant="titleSmall" style={{ color: hero.support }}>
            {` ${suffix}`}
          </Text>
        )}
      </Text>
    </View>
  );
}

interface HeroTileProps {
  value: string;
  label: string;
  /** The value's ink — the verdict accent when the tile carries it. */
  tint?: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
}

/**
 * A metric on the forest: a translucent tile, never a chip — a chip on a hero
 * reads as something to filter by. A tile that opens something says so with a
 * chevron.
 */
export function HeroTile({
  value,
  label,
  tint,
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: HeroTileProps) {
  const hero = useHeroColors();
  const isPressable = onPress !== undefined && !disabled;

  const content = (
    <>
      {icon !== undefined && (
        <MaterialCommunityIcons
          name={icon}
          size={ICON_SIZE.md}
          color={hero.support}
        />
      )}
      <View style={styles.tileText}>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[TABULAR_DIGITS, { color: tint ?? hero.ink }]}
        >
          {value}
        </Text>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: hero.support }}
        >
          {label}
        </Text>
      </View>
      {isPressable && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={ICON_SIZE.md}
          color={hero.support}
        />
      )}
    </>
  );

  const tileStyle = [styles.tile, { backgroundColor: hero.tile }];

  if (!isPressable) {
    return (
      <View
        style={tileStyle}
        accessible
        accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: hero.tile }}
      style={tileStyle}
    >
      {content}
    </Pressable>
  );
}

/** Tiles side by side, equal width. */
export function HeroTileRow({ children }: { children: ReactNode }) {
  return <View style={styles.tileRow}>{children}</View>;
}

interface HeroVerdictProps {
  sentence: string;
  /** The accent the sentence is read in; the forest ink when on plan. */
  tint?: string;
  /** A named way into the detail — `Voir le budget` — never a bare chevron. */
  link?: { label: string; onPress: () => void; accessibilityLabel?: string };
}

/** One plain-language sentence about the state, optionally ending in a link. */
export function HeroVerdict({ sentence, tint, link }: HeroVerdictProps) {
  const hero = useHeroColors();
  const text = (
    <Text variant="bodyLarge" style={{ color: tint ?? hero.ink }}>
      {sentence}
      {link !== undefined && (
        <Text variant="titleMedium" style={{ color: hero.ink }}>
          {`  ${link.label} `}
          <MaterialCommunityIcons
            name="chevron-right"
            size={ICON_SIZE.sm}
            color={hero.ink}
          />
        </Text>
      )}
    </Text>
  );

  if (link === undefined) return <View style={styles.verdict}>{text}</View>;

  return (
    <Pressable
      onPress={link.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        link.accessibilityLabel ?? `${sentence} ${link.label}`
      }
      hitSlop={HERO_ICON_SLOP}
      android_ripple={{ color: hero.tile }}
      style={styles.verdict}
    >
      {text}
    </Pressable>
  );
}

interface HeroProgressProps {
  /** 0…1, clamped. */
  progress: number;
  label: string;
  accessibilityLabel?: string;
}

/** A bar on the forest, its fill in the support ink, its percentage beside it. */
export function HeroProgress({
  progress,
  label,
  accessibilityLabel,
}: HeroProgressProps) {
  const hero = useHeroColors();
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View
      style={styles.progressRow}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.progressTrack, { backgroundColor: hero.tile }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: hero.support, width: `${clamped * 100}%` },
          ]}
        />
      </View>
      <Text
        variant="titleSmall"
        style={[TABULAR_DIGITS, { color: hero.support }]}
      >
        {label}
      </Text>
    </View>
  );
}

const PROGRESS_HEIGHT = 10;

const styles = StyleSheet.create({
  heroZone: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    // The content zone overlaps the hero by its own radius.
    paddingBottom: SPACING.lg + RADIUS.zone,
    gap: SPACING.md,
  },
  contentZone: {
    flexGrow: 1,
    marginTop: -RADIUS.zone,
    borderTopLeftRadius: RADIUS.zone,
    borderTopRightRadius: RADIUS.zone,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  figure: { gap: SPACING.xxs },
  tileRow: { flexDirection: "row", gap: SPACING.sm },
  tile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET,
    padding: SPACING.md - SPACING.xs,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  tileText: { flex: 1, gap: SPACING.xxs },
  verdict: { minHeight: TOUCH_TARGET, justifyContent: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  progressTrack: {
    flex: 1,
    height: PROGRESS_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: RADIUS.full },
});
