import { createMMKV } from "react-native-mmkv";

/**
 * Device-local, account-scoped memory for the automatic feedback invitation:
 * first on the third active day, then every three active days until the
 * account answers. Mirrors `FeedbackPromptPreferences` on iOS; the server stays
 * the source of truth for "answered".
 */
export const ACTIVE_DAYS_BETWEEN_PROMPTS = 3;

interface AccountState {
  activeDayCount: number;
  lastActiveDay: string | null;
  lastPromptedAtActiveDayCount: number | null;
  promptCount: number;
  hasSubmitted: boolean;
}

const KEY = "pulpe-feedback-prompt-account-states";
const storage = createMMKV({ id: "pulpe-feedback" });

const NEW_STATE: AccountState = {
  activeDayCount: 0,
  lastActiveDay: null,
  lastPromptedAtActiveDayCount: null,
  promptCount: 0,
  hasSubmitted: false,
};

function loadStates(): Record<string, AccountState> {
  const raw = storage.getString(KEY);
  return raw === undefined ? {} : JSON.parse(raw);
}

function update(userId: string, change: (state: AccountState) => void): void {
  const states = loadStates();
  const state = { ...NEW_STATE, ...states[userId] };
  change(state);
  storage.set(KEY, JSON.stringify({ ...states, [userId]: state }));
}

function dayIdentifier(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function recordActiveDay(userId: string, now = new Date()): void {
  const today = dayIdentifier(now);
  update(userId, (state) => {
    if (state.lastActiveDay === today) return;
    state.lastActiveDay = today;
    state.activeDayCount += 1;
  });
}

export function isFeedbackPromptEligible(userId: string): boolean {
  const state = { ...NEW_STATE, ...loadStates()[userId] };
  if (
    state.hasSubmitted ||
    state.activeDayCount < ACTIVE_DAYS_BETWEEN_PROMPTS
  ) {
    return false;
  }
  return (
    state.lastPromptedAtActiveDayCount === null ||
    state.activeDayCount - state.lastPromptedAtActiveDayCount >=
      ACTIVE_DAYS_BETWEEN_PROMPTS
  );
}

/** Returns the 1-based number of this automatic invitation, for analytics. */
export function markFeedbackPromptShown(userId: string): number {
  let promptNumber = 0;
  update(userId, (state) => {
    state.lastPromptedAtActiveDayCount = state.activeDayCount;
    state.promptCount += 1;
    promptNumber = state.promptCount;
  });
  return promptNumber;
}

export function markFeedbackSubmitted(userId: string): void {
  update(userId, (state) => {
    state.hasSubmitted = true;
  });
}
