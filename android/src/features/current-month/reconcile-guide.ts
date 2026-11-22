/**
 * Content of the « Comparer avec mes comptes » guide, kept apart from the page
 * so every figure and button is tested without rendering. Web and iOS tell the
 * same story with the same numbers.
 */
export const GUIDE_SCENES = ["compare", "type", "check"] as const;
export type GuideScene = (typeof GUIDE_SCENES)[number];

export type GuideSource = "auto" | "help";
export type GuideOutcome = "completed" | "skipped";

/** The bank says 890, Pulpe 950: the unchecked petrol of 60 is the whole gap. */
export const GUIDE_SAMPLE = { bank: 890, pulpe: 950, expense: 60 } as const;

export function guideGap(sample: typeof GUIDE_SAMPLE): number {
  return sample.pulpe - sample.bank;
}

/** « Suivant » until the last scene, then « Comparer maintenant ». */
export function guideAction(sceneIndex: number): "next" | "start" {
  return sceneIndex < GUIDE_SCENES.length - 1 ? "next" : "start";
}
