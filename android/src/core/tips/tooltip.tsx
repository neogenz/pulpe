import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

import { RADIUS, SPACING } from "@/core/ui/theme";

import { dismissTip, type TipId, useTipsStore } from "./tips-store";

const ICON_SIZE = 20;
const CLOSE_ICON_SIZE = 18;

interface TooltipAction {
  label: string;
  onPress: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface TooltipProps {
  id: TipId;
  title: string;
  message: string;
  icon: IconName;
  action?: TooltipAction;
}

/**
 * An inline card, not a popover: RN has no popover primitive worth its weight,
 * and iOS's `TipView` is itself a card sitting in the list. Renders nothing
 * once answered, so callers can mount it unconditionally.
 */
export function Tooltip({ id, title, message, icon, action }: TooltipProps) {
  const theme = useTheme();
  const isDismissed = useTipsStore((state) => state.dismissedIds.includes(id));

  if (isDismissed) return null;

  return (
    <Surface
      mode="flat"
      style={[
        styles.card,
        { backgroundColor: theme.colors.secondaryContainer },
      ]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={icon}
          size={ICON_SIZE}
          color={theme.colors.onSecondaryContainer}
        />
        <Text
          variant="titleSmall"
          style={[styles.title, { color: theme.colors.onSecondaryContainer }]}
        >
          {title}
        </Text>
        <IconButton
          icon="close"
          size={CLOSE_ICON_SIZE}
          onPress={() => dismissTip(id)}
          accessibilityLabel="Fermer le conseil"
          iconColor={theme.colors.onSecondaryContainer}
          style={styles.close}
        />
      </View>

      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSecondaryContainer }}
      >
        {message}
      </Text>

      {action !== undefined && (
        <Button
          mode="text"
          compact
          onPress={() => {
            dismissTip(id);
            action.onPress();
          }}
          style={styles.action}
        >
          {action.label}
        </Button>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  title: { flex: 1 },
  // Cancels the touch padding Paper adds around an IconButton, so the close
  // affordance does not set the card's height.
  close: { margin: 0 },
  action: { alignSelf: "flex-start" },
});
