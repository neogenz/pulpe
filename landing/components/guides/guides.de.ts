import type { Guide } from "./guides";

export const DE_GUIDES: readonly Guide[] = [
  {
    slug: "beste-budget-app-schweiz",
    title: "Beste Budget-App Schweiz: Vergleich 2026",
    description:
      "Budget-Apps, die du in der Schweiz nutzen kannst, verglichen nach Deutsch, CHF, Preis und Bankanschluss. Ohne bezahltes Ranking.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 9,
  },
  {
    slug: "krankenkassenpraemien-budgetieren",
    title: "Krankenkassenprämien 2026 budgetieren",
    description:
      "So verteilst du die Prämienerhöhung 2026 auf die restlichen Monate, mit den offiziellen BAG-Zahlen neben der Quelle.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
  },
];

export function getDeGuide(slug: string): Guide {
  const guide = DE_GUIDES.find((candidate) => candidate.slug === slug);
  if (!guide) {
    throw new Error(`German guide missing from registry: ${slug}`);
  }
  return guide;
}
