import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode, Ref } from "react";
import { useRef, useState } from "react";
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
  /** The gutter to keep around the content. Wider inside a sheet than a page. */
  inset?: number;
  /** What the rail sits on, and so what it fades into: a sheet is not the page. */
  background?: string;
  accessibilityLabel?: string;
}

interface RailEdges {
  hasLeading: boolean;
  hasTrailing: boolean;
}

const INITIAL_EDGES: RailEdges = {
  hasLeading: false,
  hasTrailing: false,
};

export function nextRailEdges(
  current: RailEdges,
  offset: number,
  contentWidth: number,
  railWidth: number,
): RailEdges {
  const overflow = contentWidth - railWidth;
  const next = {
    hasLeading: offset > 1,
    hasTrailing: overflow > 1 && offset < overflow - 1,
  };

  return next.hasLeading === current.hasLeading &&
    next.hasTrailing === current.hasTrailing
    ? current
    : next;
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
  inset = SCREEN_PADDING,
  background,
  accessibilityLabel,
}: FadingRailProps) {
  const theme = useTheme();
  const offset = useRef(0);
  const contentWidth = useRef(0);
  const railWidth = useRef(0);
  const edgesRef = useRef<RailEdges>(INITIAL_EDGES);
  const [edges, setEdges] = useState(INITIAL_EDGES);

  function updateEdges() {
    const next = nextRailEdges(
      edgesRef.current,
      offset.current,
      contentWidth.current,
      railWidth.current,
    );
    if (next === edgesRef.current) return;
    edgesRef.current = next;
    setEdges(next);
  }

  const opaque = background ?? theme.colors.background;
  const clear = `${opaque}00`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => {
        railWidth.current = event.nativeEvent.layout.width;
        updateEdges();
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = event.nativeEvent.contentOffset.x;
          updateEdges();
        }}
        onContentSizeChange={(width) => {
          contentWidth.current = width;
          updateEdges();
        }}
      >
        {children}
      </ScrollView>

      {edges.hasLeading && (
        <LinearGradient
          pointerEvents="none"
          colors={[opaque, clear]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, styles.leading]}
        />
      )}

      {edges.hasTrailing && (
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
    // Chips carry their own shadow on Android and sit flush against whatever
    // is above and below them without this.
    paddingVertical: SPACING.xs,
  },
  fade: { position: "absolute", top: 0, bottom: 0, width: FADE_WIDTH },
  leading: { left: 0 },
  trailing: { right: 0 },
});
