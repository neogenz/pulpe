import type { StepOptions } from 'shepherd.js';

/**
 * Available tutorial tour identifiers as array (for runtime validation)
 */
export const TOUR_IDS = [
  'dashboard-welcome',
  'add-transaction',
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
  /** Unique identifier for the tour */
  id: TourId;
  /** Display name of the tour */
  name: string;
  /** Brief description of what the tour covers */
  description: string;
  /** When to trigger the tour automatically */
  triggerOn?: 'first-visit' | 'manual';
  /** Target route for this tour (without /app prefix). Used for navigation before starting. */
  targetRoute?: string;
  /** Array of tour steps */
  steps: StepOptions[];
}

/**
 * Tutorial state tracked across sessions
 */
export interface TutorialState {
  /** Whether any tutorial is currently active */
  isActive: boolean;
  /** ID of the currently running tour */
  currentTour: TourId | null;
  /** List of completed tour IDs */
  completedTours: TourId[];
  /** List of skipped/cancelled tour IDs */
  skippedTours: TourId[];
  /** User preferences for tutorials */
  preferences: TutorialPreferences;
}

/**
 * User preferences for tutorial behavior
 */
export interface TutorialPreferences {
  /** Whether tutorials are enabled globally */
  enabled: boolean;
  /** Whether to auto-start tours on first visit */
  autoStart: boolean;
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
 * Default tutorial preferences
 */
export const DEFAULT_TUTORIAL_PREFERENCES: TutorialPreferences = {
  enabled: true,
  autoStart: true,
};

/**
 * Default tutorial state
 */
export const DEFAULT_TUTORIAL_STATE: TutorialState = {
  isActive: false,
  currentTour: null,
  completedTours: [],
  skippedTours: [],
  preferences: DEFAULT_TUTORIAL_PREFERENCES,
};
