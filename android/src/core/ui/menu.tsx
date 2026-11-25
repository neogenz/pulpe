import { useEffect, useRef, type ComponentProps } from "react";
import { BackHandler } from "react-native";
import { Menu as PaperMenu } from "react-native-paper";

/**
 * Every ⋮ menu in the app. Paper's Menu closes on Back but does not consume
 * the press, so the screen behind it pops too. While the menu is open, Back
 * only closes it.
 */
export function Menu(props: ComponentProps<typeof PaperMenu>) {
  const { visible, onDismiss } = props;
  // Callers pass an inline onDismiss: a ref keeps one Back listener for as
  // long as the menu is open. Refreshed before the effect that reads it.
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onDismissRef.current?.();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible]);

  return <PaperMenu {...props} />;
}

Menu.Item = PaperMenu.Item;
