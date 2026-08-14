import { StyleSheet, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { Eyebrow } from "@/core/ui/eyebrow";
import { SPACING } from "@/core/ui/theme";

export function SettingsSection({
  /** Written in sentence case: `Eyebrow` sets the capitals, so a screen reader
   *  is still handed a word rather than a run of letters. */
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      <Card mode="contained">
        <View style={styles.rows}>{children}</View>
      </Card>
    </View>
  );
}

export function SettingsRow({
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
      title={title}
      description={description}
      titleStyle={tint === undefined ? undefined : { color: tint }}
      left={(props) => <List.Icon {...props} icon={icon} color={tint} />}
      right={(props) =>
        value === undefined ? (
          <List.Icon
            {...props}
            icon={isExternal ? "open-in-new" : "chevron-right"}
          />
        ) : (
          <Text
            {...props}
            variant="labelLarge"
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
  rows: { paddingVertical: SPACING.xxs },
  value: { alignSelf: "center" },
});
