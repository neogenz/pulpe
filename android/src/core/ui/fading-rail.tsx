import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode, Ref } from "react";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useTheme } from "react-native-paper";

import { SCREEN_PADDING, SPACING } from "@/core/ui/theme";

/** Wide enough for the cut-off item to read as "keep going", narrow enough not to hide one. */
const FADE_WIDTH = 32;

interface FadingRailProps {
  children: ReactNode;
  /** The pager scrolls itself to the selected month; nothing else needs this. */
  scrollRef?: Ref<ScrollView>;
  accessibilityLabel?: string;
}

/**
 * A row that runs from one display edge to the other and says so.
 *
 * The gutter every screen keeps is applied to the rail's *content*, never to
 * the rail: an item then scrolls past the margin instead of being clipped by
 * it. On its own that produced a row whose last chip was sliced in half at the
 * bezel and read as a rendering bug rather than as more content — so each edge
 * with something behind it wears a fade into the page colour, and only while
 * there is something there.
 *
 * The far stop is the background colour at zero alpha rather than
 * `"transparent"`, which Android interpolates through black and turns a fade
 * into a smudge.
 */
export function FadingRail({
  children,
  scrollRef,
  accessibilityLabel,
}: FadingRailProps) {
  const theme = useTheme();
  const [offset, setOffset] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [railWidth, setRailWidth] = useState(0);

  const overflow = contentWidth - railWidth;
  const hasLeading = offset > 1;
  const hasTrailing = offset < overflow - 1;

  const opaque = theme.colors.background;
  const clear = `${opaque}00`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) =>
        setRailWidth(event.nativeEvent.layout.width)
      }
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          setOffset(event.nativeEvent.contentOffset.x)
        }
        onContentSizeChange={setContentWidth}
      >
        {children}
      </ScrollView>

      {hasLeading && (
        <LinearGradient
          pointerEvents="none"
          colors={[opaque, clear]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, styles.leading]}
        />
      )}

      {hasTrailing && (
        <LinearGradient
          pointerEvents="none"
          colors={[clear, opaque]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, styles.trailing]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SCREEN_PADDING,
    // Chips carry their own shadow on Android and sit flush against whatever
    // is above and below them without this.
    paddingVertical: SPACING.xs,
  },
  fade: { position: "absolute", top: 0, bottom: 0, width: FADE_WIDTH },
  leading: { left: 0 },
  trailing: { right: 0 },
});
