import { useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/** How far the list must travel one way before the FAB follows it. */
const TRAVEL = 24;

interface FabScrollState {
  isVisible: boolean;
  /** Where the current run of scrolling one way started. */
  anchor: number;
}

/**
 * The FAB steps aside while the list goes down and comes back as soon as it
 * goes up, at the top or at the end: a floating button otherwise sits on
 * whatever the scroll brings under it, a section's « Afficher » included.
 */
export function nextFabScrollState(
  state: FabScrollState,
  offset: number,
  isAtEnd: boolean,
): FabScrollState {
  if (offset <= 0 || isAtEnd) return { isVisible: true, anchor: offset };
  if (state.isVisible) {
    return offset - state.anchor > TRAVEL
      ? { isVisible: false, anchor: offset }
      : { isVisible: true, anchor: Math.min(state.anchor, offset) };
  }
  return state.anchor - offset > TRAVEL
    ? { isVisible: true, anchor: offset }
    : { isVisible: false, anchor: Math.max(state.anchor, offset) };
}

/** Spread `scrollProps` on the screen's ScrollView, pass `isFabVisible` to its FAB. */
export function useFabOnScroll() {
  const state = useRef<FabScrollState>({ isVisible: true, anchor: 0 });
  const [isFabVisible, setFabVisible] = useState(true);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offset = contentOffset.y;
    const isAtEnd = offset + layoutMeasurement.height >= contentSize.height - 1;
    state.current = nextFabScrollState(state.current, offset, isAtEnd);
    setFabVisible(state.current.isVisible);
  }

  return {
    isFabVisible,
    scrollProps: { onScroll, scrollEventThrottle: 16 },
  };
}
