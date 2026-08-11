import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, useTheme } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { runSharedSmoke } from "@/smoke/shared-smoke";

export default function HomeScreen() {
  const theme = useTheme();
  const signOut = useSessionStore((state) => state.signOut);
  const email = useSessionStore((state) => state.user?.email);
  const smoke = runSharedSmoke();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.block}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {smoke.period}
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Disponible à dépenser
        </Text>
        <Text variant="displaySmall" style={TABULAR_DIGITS}>
          {smoke.available}
        </Text>
      </View>

      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {email ?? "Session sans e-mail"}
      </Text>

      <Button mode="outlined" onPress={() => void signOut()}>
        Se déconnecter
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  block: { gap: SPACING.xs },
});
