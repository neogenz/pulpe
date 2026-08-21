import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/** How much of the display a sheet may take before its body starts scrolling. */
export const SHEET_HEIGHT_RATIO = 0.88;

/**
 * How much room the soft keyboard is taking, in dp, or 0 while it is down.
 *
 * `useWindowDimensions` cannot answer this, though it reads as though it could:
 * `DeviceInfoModule` builds the window metrics from `systemBars()` and
 * `displayCutout()` and never from `Type.ime()`, so the height it reports is
 * the same whether the keyboard is up or not. `windowSoftInputMode` does not
 * rescue it either — this app builds edge to edge (`edgeToEdgeEnabled=true`),
 * and there `adjustResize` no longer resizes the window at all; the keyboard
 * arrives as an inset instead.
 *
 * The keyboard events are the one source that does read that inset:
 * `ReactRootView` computes their height from `rootInsets.getInsets(Type.ime())`
 * and emits it on every change.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

interface SheetBoxInput {
  windowHeight: number;
  keyboardHeight: number;
  /** The navigation bar's inset, from `useSafeAreaInsets`. */
  safeBottom: number;
}

interface SheetBox {
  maxHeight: number;
  marginBottom: number;
}

/**
 * The box a sheet gets to draw in, given the keyboard currently on screen.
 *
 * Both halves are needed and neither is enough alone: the margin lifts a sheet
 * that is centred in the full window clear of the keyboard, and the cap keeps a
 * tall one from growing back into it.
 *
 * React Native reports the keyboard's height *above the navigation bar*
 * (`imeInsets.bottom - barInsets.bottom`), while the sheet is centred in a
 * window that runs under that bar — so the bar's own inset has to be added
 * back, or the sheet clears the keys and sits on the gesture pill.
 */
export function sheetBox({
  windowHeight,
  keyboardHeight,
  safeBottom,
}: SheetBoxInput): SheetBox {
  const reserved = keyboardHeight === 0 ? 0 : keyboardHeight + safeBottom;

  return {
    maxHeight: (windowHeight - reserved) * SHEET_HEIGHT_RATIO,
    marginBottom: reserved,
  };
}
