import { captureEvent } from "@/core/observability/analytics";

import {
  clearDraft,
  readDraft,
  readHandoffSeen,
  readOnboardingCompleted,
  writeDraft,
  writeHandoffSeen,
  writeOnboardingCompleted,
} from "./draft-storage";
import { hasAccount, wouldExitOnBack } from "./onboarding-selectors";
import {
  acknowledgeHandoff,
  addCustomTransaction,
  beginOnboarding,
  completeOnboarding,
  configureEmailUser,
  configureSocialUser,
  goToNextStep,
  goToPreviousStep,
  jumpToStepForEdit,
  markPinSetupCompleted,
  MAX_CUSTOM_TRANSACTIONS,
  removeCustomTransaction,
  reconcileOnboardingWithVault,
  resetOnboarding,
  restoreOnboardingDraft,
  selectCurrency,
  startAfterWelcome,
  toggleSuggestion,
  updateAnswers,
  useOnboardingStore,
} from "./onboarding-store";
import type { OnboardingTransaction } from "./onboarding-transaction";

/**
 * `draft-storage` is the seam over MMKV, which is a Nitro module with no jest
 * mock of its own — mocking the seam keeps the state machine testable without
 * booting anything native. The fake below is a plain in-memory slot, so the
 * "kill the app and relaunch" case is a `writeDraft` followed by a fresh
 * `restoreOnboardingDraft`.
 */
jest.mock("./draft-storage", () => {
  let stored: unknown = null;
  let isCompleted = false;
  let isHandoffSeen = false;
  return {
    readDraft: jest.fn(() => stored),
    writeDraft: jest.fn((draft: unknown) => {
      stored = JSON.parse(JSON.stringify(draft));
    }),
    clearDraft: jest.fn(() => {
      stored = null;
    }),
    readOnboardingCompleted: jest.fn(() => isCompleted),
    writeOnboardingCompleted: jest.fn(() => {
      isCompleted = true;
    }),
    readHandoffSeen: jest.fn(() => isHandoffSeen),
    writeHandoffSeen: jest.fn(() => {
      isHandoffSeen = true;
    }),
  };
});

/**
 * The real module builds a PostHog client from `ENV`, which no test process
 * has. Mocking the seam also makes the funnel assertable: what the flow reports
 * is a behaviour of the state machine, not a detail of the SDK.
 */
jest.mock("@/core/observability/analytics", () => ({
  captureEvent: jest.fn(),
}));

const captured = jest.mocked(captureEvent);

/** The properties sent with an event, or null when it never fired. */
function propertiesOf(event: string): Record<string, unknown> | null {
  const call = captured.mock.calls.find(([name]) => name === event);
  return call === undefined ? null : (call[1] ?? {});
}

function timesCaptured(event: string): number {
  return captured.mock.calls.filter(([name]) => name === event).length;
}

const mocked = {
  readDraft: jest.mocked(readDraft),
  writeDraft: jest.mocked(writeDraft),
  clearDraft: jest.mocked(clearDraft),
  readOnboardingCompleted: jest.mocked(readOnboardingCompleted),
  writeOnboardingCompleted: jest.mocked(writeOnboardingCompleted),
  readHandoffSeen: jest.mocked(readHandoffSeen),
  writeHandoffSeen: jest.mocked(writeHandoffSeen),
};

function transaction(
  id: string,
  overrides: Partial<OnboardingTransaction> = {},
): OnboardingTransaction {
  return {
    id,
    amount: 100,
    type: "expense",
    name: `Ligne ${id}`,
    expenseType: "fixed",
    isRecurring: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetOnboarding();
  mocked.clearDraft.mockClear();
});

describe("navigation", () => {
  it("walks every step for an email signup", () => {
    const visited = ["welcome"];
    while (goToNextStep()) {
      visited.push(useOnboardingStore.getState().currentStep);
    }

    expect(visited).toEqual([
      "welcome",
      "firstName",
      "registration",
      "income",
      "charges",
      "savings",
      "budgetPreview",
      "pinSetup",
    ]);
  });

  it("stops at the pin ceremony instead of wrapping around", () => {
    while (goToNextStep()) {
      /* walk to the end */
    }

    expect(goToNextStep()).toBe(false);
    expect(useOnboardingStore.getState().currentStep).toBe("pinSetup");
  });

  // What the preview's CTA reads: a false return means there is nothing left to
  // ask, so it submits rather than navigating.
  it("has no step past the preview once the pin is set", () => {
    markPinSetupCompleted();
    jumpToStepForEdit("budgetPreview");
    useOnboardingStore.setState({ editReturnStep: null });

    expect(goToNextStep()).toBe(false);
    expect(useOnboardingStore.getState().currentStep).toBe("budgetPreview");
  });

  it("skips registration once the account exists", () => {
    goToNextStep();
    configureEmailUser();
    goToNextStep();

    expect(useOnboardingStore.getState().currentStep).toBe("income");
  });

  it("skips firstName and registration when Google supplied a name", () => {
    configureSocialUser("Maxime");
    startAfterWelcome();

    expect(useOnboardingStore.getState().currentStep).toBe("income");
  });

  it("still asks for a first name when Google supplied none", () => {
    configureSocialUser(null);
    startAfterWelcome();

    expect(useOnboardingStore.getState().currentStep).toBe("firstName");
  });

  it("reports the step before which back leaves the flow", () => {
    goToNextStep();
    expect(wouldExitOnBack(useOnboardingStore.getState())).toBe(true);

    goToNextStep();
    expect(wouldExitOnBack(useOnboardingStore.getState())).toBe(false);
  });

  it("steps back over the steps it skipped forward", () => {
    configureSocialUser("Maxime");
    startAfterWelcome();
    goToNextStep();

    expect(useOnboardingStore.getState().currentStep).toBe("charges");
    goToPreviousStep();
    expect(useOnboardingStore.getState().currentStep).toBe("income");
    goToPreviousStep();
    expect(useOnboardingStore.getState().currentStep).toBe("welcome");
  });

  it("returns to the preview after an edit, in both directions", () => {
    useOnboardingStore.setState({ currentStep: "budgetPreview" });

    jumpToStepForEdit("income");
    expect(useOnboardingStore.getState().currentStep).toBe("income");

    goToNextStep();
    expect(useOnboardingStore.getState().currentStep).toBe("budgetPreview");

    jumpToStepForEdit("charges");
    goToPreviousStep();
    expect(useOnboardingStore.getState().currentStep).toBe("budgetPreview");
  });
});

describe("draft", () => {
  it("resumes at the step the app died on, with the answers entered there", () => {
    goToNextStep();
    updateAnswers({ firstName: "Maxime" });
    configureEmailUser();
    goToNextStep();
    updateAnswers({ monthlyIncome: 6500 });
    goToNextStep();
    toggleSuggestion(transaction("suggestion-courses", { amount: 600 }));

    // The relaunch: nothing in memory, only what reached the draft.
    useOnboardingStore.setState({
      currentStep: "welcome",
      firstName: "",
      monthlyIncome: null,
      customTransactions: [],
      wasEmailRegistered: false,
    });
    restoreOnboardingDraft();

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe("charges");
    expect(state.firstName).toBe("Maxime");
    expect(state.monthlyIncome).toBe(6500);
    expect(state.customTransactions).toHaveLength(1);
    expect(state.wasEmailRegistered).toBe(true);
  });

  it("comes back knowing it has an account, so registration stays behind the user", () => {
    goToNextStep();
    configureEmailUser();
    goToNextStep();

    // The relaunch: nothing in memory, only what reached the draft.
    useOnboardingStore.setState({
      currentStep: "welcome",
      wasEmailRegistered: false,
    });
    restoreOnboardingDraft();

    expect(hasAccount(useOnboardingStore.getState())).toBe(true);
    // The account exists; stepping back must not offer to create it again.
    goToPreviousStep();
    expect(useOnboardingStore.getState().currentStep).toBe("firstName");
  });

  it("comes back a Google run, with the steps it skipped still skipped", () => {
    configureSocialUser("Maxime");
    startAfterWelcome();

    useOnboardingStore.setState({
      currentStep: "welcome",
      isSocialAuth: false,
      socialProvidedName: false,
    });
    restoreOnboardingDraft();

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe("income");
    expect(state.isSocialAuth).toBe(true);
    goToPreviousStep();
    expect(useOnboardingStore.getState().currentStep).toBe("welcome");
  });

  it("resumes at the preview when the PIN ceremony already completed", () => {
    useOnboardingStore.setState({
      isFlowActive: true,
      currentStep: "pinSetup",
    });
    markPinSetupCompleted();

    useOnboardingStore.setState({
      isFlowActive: false,
      currentStep: "welcome",
      hasCompletedPinSetup: false,
    });
    restoreOnboardingDraft();

    expect(useOnboardingStore.getState()).toMatchObject({
      isFlowActive: true,
      currentStep: "budgetPreview",
      hasCompletedPinSetup: true,
    });
  });

  it("leaves the flow at welcome when there is nothing to resume", () => {
    mocked.readDraft.mockReturnValueOnce(null);

    restoreOnboardingDraft();

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe("welcome");
    expect(state.isFlowActive).toBe(false);
  });

  it("hands the router to the flow as soon as a draft exists", () => {
    expect(useOnboardingStore.getState().isFlowActive).toBe(false);

    beginOnboarding();

    expect(useOnboardingStore.getState().isFlowActive).toBe(true);
    expect(useOnboardingStore.getState().currentStep).toBe("firstName");
  });

  it("gives the router back once the run is finished", () => {
    beginOnboarding();

    completeOnboarding();

    const state = useOnboardingStore.getState();
    expect(state.isFlowActive).toBe(false);
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(mocked.writeOnboardingCompleted).toHaveBeenCalled();
    expect(mocked.clearDraft).toHaveBeenCalled();
  });

  it("remembers a finished run across an abandoned one", () => {
    beginOnboarding();
    completeOnboarding();

    beginOnboarding();
    resetOnboarding();

    const state = useOnboardingStore.getState();
    expect(state.isFlowActive).toBe(false);
    expect(state.hasCompletedOnboarding).toBe(true);
  });

  it("shows the handoff once and never again", () => {
    beginOnboarding();
    completeOnboarding();
    expect(useOnboardingStore.getState().hasSeenHandoff).toBe(false);

    acknowledgeHandoff();

    expect(mocked.writeHandoffSeen).toHaveBeenCalled();
    expect(useOnboardingStore.getState().hasSeenHandoff).toBe(true);

    // A second run on the same device must not resurrect it.
    beginOnboarding();
    completeOnboarding();
    expect(useOnboardingStore.getState().hasSeenHandoff).toBe(true);
  });

  it("reads the handoff flag back on a cold start", () => {
    mocked.readHandoffSeen.mockReturnValueOnce(true);

    restoreOnboardingDraft();

    expect(useOnboardingStore.getState().hasSeenHandoff).toBe(true);
  });

  it("never persists the email typed into the registration form", () => {
    goToNextStep();
    updateAnswers({ firstName: "Maxime" });

    expect(mocked.writeDraft).toHaveBeenCalled();
    for (const [draft] of mocked.writeDraft.mock.calls) {
      expect(draft).not.toHaveProperty("email");
    }
  });

  it("wipes a prior email draft when the user signs up with Google instead", () => {
    goToNextStep();
    updateAnswers({ firstName: "Maxime", monthlyIncome: 6500 });

    configureSocialUser("Google");

    expect(mocked.clearDraft).toHaveBeenCalled();
    const state = useOnboardingStore.getState();
    expect(state.monthlyIncome).toBeNull();
    expect(state.firstName).toBe("Google");
    // And opens one of its own immediately: the account exists from here on,
    // and a signed-in user with no draft is one the flow can no longer claim.
    expect(mocked.readDraft()).toMatchObject({ isSocialAuth: true });
  });

  it("starts Google onboarding only when the server vault needs setup", () => {
    configureSocialUser("Maxime");

    reconcileOnboardingWithVault("setupRequired");

    expect(useOnboardingStore.getState()).toMatchObject({
      isFlowActive: true,
      currentStep: "income",
      isSocialAuth: true,
    });
    expect(propertiesOf("signup_completed")).toEqual({ method: "google" });
  });

  it("discards a Google signup draft for a configured returning account", () => {
    configureSocialUser("Maxime");

    reconcileOnboardingWithVault("locked");

    expect(useOnboardingStore.getState()).toMatchObject({
      isFlowActive: false,
      currentStep: "welcome",
      isSocialAuth: false,
    });
    expect(mocked.readDraft()).toBeNull();
    expect(propertiesOf("signup_completed")).toBeNull();
  });

  it("keeps an interrupted PIN run and requires the existing PIN", () => {
    useOnboardingStore.setState({
      isFlowActive: true,
      currentStep: "pinSetup",
      hasCompletedPinSetup: false,
    });

    reconcileOnboardingWithVault("locked");

    expect(useOnboardingStore.getState()).toMatchObject({
      isFlowActive: true,
      currentStep: "budgetPreview",
      hasCompletedPinSetup: true,
    });
  });

  it("keeps Google classification pending when vault bootstrap fails", () => {
    configureSocialUser("Maxime");

    reconcileOnboardingWithVault("unknown");

    expect(useOnboardingStore.getState()).toMatchObject({
      isFlowActive: true,
      currentStep: "welcome",
      isSocialAuth: true,
    });
    expect(propertiesOf("signup_completed")).toBeNull();
  });
});

describe("answers", () => {
  it("drops the health insurance amount when leaving CHF", () => {
    updateAnswers({ healthInsurance: 350 });

    selectCurrency("EUR");

    expect(useOnboardingStore.getState().healthInsurance).toBeNull();
  });

  it("keeps it when staying in CHF", () => {
    updateAnswers({ healthInsurance: 350 });

    selectCurrency("CHF");

    expect(useOnboardingStore.getState().healthInsurance).toBe(350);
  });
});

describe("custom transactions", () => {
  it("toggles a suggestion on and back off by id", () => {
    const suggestion = transaction("suggestion-courses");

    toggleSuggestion(suggestion);
    expect(useOnboardingStore.getState().customTransactions).toHaveLength(1);

    toggleSuggestion(suggestion);
    expect(useOnboardingStore.getState().customTransactions).toHaveLength(0);
  });

  it("refuses to go past the cap the server enforces", () => {
    for (let index = 0; index < MAX_CUSTOM_TRANSACTIONS + 5; index += 1) {
      addCustomTransaction(transaction(`line-${index}`));
    }

    expect(useOnboardingStore.getState().customTransactions).toHaveLength(
      MAX_CUSTOM_TRANSACTIONS,
    );
  });

  it("removes the line the user asked for and leaves the rest", () => {
    addCustomTransaction(transaction("a"));
    addCustomTransaction(transaction("b"));

    removeCustomTransaction("a");

    expect(
      useOnboardingStore.getState().customTransactions.map((it) => it.id),
    ).toEqual(["b"]);
  });
});

/**
 * The funnel, under the names `shared/src/feature-flags.ts` publishes. What is
 * asserted here is the shape a dashboard reads: which event, with which
 * dimensions, and how many times.
 */
describe("the funnel", () => {
  it("opens once when the email path leaves welcome", () => {
    beginOnboarding();

    expect(propertiesOf("onboarding_started")).toEqual({ method: "email" });

    // A second entry in the same run is the same run, not a second funnel.
    beginOnboarding();
    expect(timesCaptured("onboarding_started")).toBe(1);
  });

  it("opens as a Google run when that is the path taken", () => {
    configureSocialUser("Maxime");
    startAfterWelcome();

    expect(propertiesOf("onboarding_started")).toEqual({ method: "google" });
  });

  it("reports each step it leaves, positioned in the path being walked", () => {
    goToNextStep();
    configureEmailUser();
    goToNextStep();

    // Welcome is a pitch, not a question — `onboarding_started` covers it.
    expect(propertiesOf("onboarding_step_completed")).toEqual({
      step: "first_name",
      step_index: 1,
      step_count: 6,
      auth_method: "email",
    });
    expect(timesCaptured("onboarding_step_completed")).toBe(1);
  });

  it("counts a Google run against its own shorter path", () => {
    configureSocialUser("Maxime");
    startAfterWelcome();
    goToNextStep();

    expect(propertiesOf("onboarding_step_completed")).toEqual({
      step: "income",
      step_index: 1,
      step_count: 4,
      auth_method: "google",
    });
  });

  it("says a run was picked back up rather than started afresh", () => {
    goToNextStep();
    configureEmailUser();
    goToNextStep();
    captured.mockClear();

    restoreOnboardingDraft();

    expect(propertiesOf("onboarding_resumed")).toEqual({
      method: "email",
      source: "draft",
      resumed_at_step: "income",
    });
    // A resumed run has already started; both would double the top of the funnel.
    expect(timesCaptured("onboarding_started")).toBe(0);
  });

  it("closes the ceremony that ends the flow", () => {
    markPinSetupCompleted();

    expect(propertiesOf("pin_setup_completed")).toEqual({});
  });

  it("carries no amount out of a run that answered with amounts", () => {
    goToNextStep();
    updateAnswers({ monthlyIncome: 6500, housingCosts: 1800 });
    goToNextStep();

    for (const [, properties] of captured.mock.calls) {
      expect(Object.values(properties ?? {})).not.toContain(6500);
      expect(Object.values(properties ?? {})).not.toContain(1800);
    }
  });

  it("starts a fresh funnel once a run has ended", () => {
    beginOnboarding();
    resetOnboarding();
    captured.mockClear();

    beginOnboarding();

    expect(timesCaptured("onboarding_started")).toBe(1);
  });
});
