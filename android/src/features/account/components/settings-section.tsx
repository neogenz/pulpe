import { StyleSheet, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { SPACING } from "@/core/ui/theme";

/**
 * A group's title the way Android's own Settings app sets one: sentence case,
 * in the primary colour, above the rows — not iOS's small tracked capitals.
 */
export function SettingsSectionTitle({
  children,
  color,
}: {
  children: string;
  /** The danger zone's red; the primary colour otherwise. */
  color?: string;
}) {
  const theme = useTheme();

  return (
    <Text
      variant="titleSmall"
      accessibilityRole="header"
      style={[styles.title, { color: color ?? theme.colors.primary }]}
    >
      {children}
    </Text>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      <Card mode="contained">
        <View style={styles.rows}>{children}</View>
      </Card>
    </View>
  );
}

export function SettingsRow({
  testID,
  title,
  description,
  icon,
  /** Right-hand text: the setting as it stands, not what tapping does. */
  value,
  isExternal = false,
  isDestructive = false,
  isDisabled = false,
  onPress,
}: {
  testID?: string;
  title: string;
  description?: string;
  icon: string;
  value?: string;
  isExternal?: boolean;
  isDestructive?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = isDestructive ? theme.colors.error : undefined;

  return (
    <List.Item
      testID={testID}
      title={title}
      description={description}
      titleStyle={tint === undefined ? undefined : { color: tint }}
      left={(props) => <List.Icon {...props} icon={icon} color={tint} />}
      // A row that opens a screen says nothing more than its ripple, as in
      // Android's Settings; only leaving the app is marked.
      right={(props) =>
        value === undefined ? (
          isExternal ? (
            <List.Icon {...props} icon="open-in-new" />
          ) : undefined
        ) : (
          // One line, never shrunk to a word per line: "Le 1er" broke in two
          // beside a description that took the room first.
          <Text
            {...props}
            variant="labelLarge"
            numberOfLines={1}
            style={[props.style, styles.value]}
          >
            {value}
          </Text>
        )
      }
      onPress={onPress}
      disabled={isDisabled}
    />
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  title: { paddingHorizontal: SPACING.md },
  rows: { paddingVertical: SPACING.xxs },
  value: { alignSelf: "center", flexShrink: 0, maxWidth: "40%" },
});
