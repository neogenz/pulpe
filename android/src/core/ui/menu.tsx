import { useEffect, type ComponentProps } from "react";
import { BackHandler } from "react-native";
import { Menu as PaperMenu } from "react-native-paper";

/**
 * Every ⋮ menu in the app. Paper's Menu closes on Back but does not consume
 * the press, so the screen behind it pops too. While the menu is open, Back
 * only closes it.
 */
export function Menu(props: ComponentProps<typeof PaperMenu>) {
  const { visible, onDismiss } = props;

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onDismiss?.();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onDismiss]);

  return <PaperMenu {...props} />;
}

Menu.Item = PaperMenu.Item;
