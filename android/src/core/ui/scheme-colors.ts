import { useColorScheme } from "react-native";

import {
  FINANCIAL_COLORS,
  HERO_COLORS,
  PREVIEW_COLORS,
  SHEET_COLORS,
} from "@/core/ui/theme";

/**
 * Which half of a two-scheme palette to read.
 *
 * `useColorScheme` can return `null` — the system has no preference yet — and
 * twenty screens each decided for themselves that this means light. That is the
 * right answer, but it was twenty chances to index a palette with `null` and
 * only be caught by someone switching their phone at the right moment.
 */
export function useSchemeName(): "light" | "dark" {
  return useColorScheme() === "dark" ? "dark" : "light";
}

/** The financial accents — income, expense, savings — for the scheme in force. */
export function useFinancialColors() {
  return FINANCIAL_COLORS[useSchemeName()];
}

/** The forest every hero sits on, and the inks that read on it. */
export function useHeroColors() {
  return HERO_COLORS[useSchemeName()];
}

/** The onboarding preview's mint card and its ink, for the scheme in force. */
export function usePreviewColors() {
  return PREVIEW_COLORS[useSchemeName()];
}

/** The surface a form sheet rises on, for the scheme in force. */
export function useSheetColors() {
  return SHEET_COLORS[useSchemeName()];
}
