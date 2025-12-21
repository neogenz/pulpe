import type { StepOptions } from 'shepherd.js';

/**
 * Available tutorial tour identifiers as array (for runtime validation)
 */
export const TOUR_IDS = [
  'dashboard-welcome',
  'templates-intro',
  'budget-management',
  'budget-calendar',
] as const;

/**
 * Available tutorial tour identifiers
 */
export type TourId = (typeof TOUR_IDS)[number];

/**
 * Tutorial tour configuration
 */
export interface TutorialTour {
  id: TourId;
  name: string;
  description: string;
  triggerOn?: 'first-visit' | 'manual';
  /** Target route for this tour (without /app prefix). Used for navigation before starting. */
  targetRoute?: string;
  steps: StepOptions[];
}

/**
 * Tutorial state tracked across sessions
 */
export interface TutorialState {
  isActive: boolean;
  currentTour: TourId | null;
  completedTours: TourId[];
  skippedTours: TourId[];
}

/**
 * Tutorial event types for tracking and analytics
 */
export interface TutorialEvent {
  tourId: TourId;
  action: 'started' | 'completed' | 'cancelled' | 'step_viewed';
  stepIndex?: number;
  timestamp: number;
}

/**
 * Default tutorial state
 */
export const DEFAULT_TUTORIAL_STATE: TutorialState = {
  isActive: false,
  currentTour: null,
  completedTours: [],
  skippedTours: [],
};
