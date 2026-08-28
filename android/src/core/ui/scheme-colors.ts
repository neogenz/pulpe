import { useColorScheme } from "react-native";

import { FINANCIAL_COLORS, HOME_HERO_COLORS } from "@/core/ui/theme";

/**
 * Which half of a two-scheme palette to read.
 *
 * `useColorScheme` can return `null` — the system has no preference yet — and
 * twenty screens each decided for themselves that this means light. That is the
 * right answer, but it was twenty chances to index a palette with `null` and
 * only be caught by someone switching their phone at the right moment.
 */
function useSchemeName(): "light" | "dark" {
  return useColorScheme() === "dark" ? "dark" : "light";
}

/** The financial accents — income, expense, savings — for the scheme in force. */
export function useFinancialColors() {
  return FINANCIAL_COLORS[useSchemeName()];
}

/** The dashboard hero's mint surface and its ink, for the scheme in force. */
export function useHeroColors() {
  return HOME_HERO_COLORS[useSchemeName()];
}
