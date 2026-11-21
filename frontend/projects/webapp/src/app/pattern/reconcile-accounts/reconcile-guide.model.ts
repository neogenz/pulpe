/**
 * Content of the « Comparer avec mes comptes » guide, kept apart from the view so the figures
 * and the button choice are tested without rendering. iOS and Android tell the same story with
 * the same numbers.
 */
export const GUIDE_SCENES = ['compare', 'type', 'check'] as const;
export type GuideScene = (typeof GUIDE_SCENES)[number];

/** `auto`: first open on this device; `help`: replayed from the « ? » button. */
export type GuideSource = 'auto' | 'help';
export type GuideOutcome = 'completed' | 'skipped';

export const GUIDE_SAMPLE = { bank: 890, pulpe: 950, essence: 60 } as const;

/** What the first scene shows between the two figures, derived so the scene cannot contradict itself. */
export const GUIDE_GAP = GUIDE_SAMPLE.pulpe - GUIDE_SAMPLE.bank;

/** « Suivant » until the last scene, then « Comparer maintenant ». */
export function guideAction(sceneIndex: number): 'next' | 'start' {
  return sceneIndex < GUIDE_SCENES.length - 1 ? 'next' : 'start';
}
