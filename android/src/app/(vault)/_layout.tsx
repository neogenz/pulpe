import { Stack } from "expo-router";

export default function VaultLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Undeclared children are sorted by name length, which put `vault-setup`
          ahead of `vault-unlock`: a flip landing here would ask for a new PIN. */}
      <Stack.Screen name="vault-unlock" />
    </Stack>
  );
}
