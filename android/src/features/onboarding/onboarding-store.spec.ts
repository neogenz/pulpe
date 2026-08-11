import {
  clearDraft,
  readDraft,
  readHandoffSeen,
  readOnboardingCompleted,
  writeDraft,
  writeHandoffSeen,
  writeOnboardingCompleted,
} from "./draft-storage";
import { wouldExitOnBack } from "./onboarding-selectors";
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
  resetOnboarding,
  restoreOnboardingDraft,
  resumeEmailUserAfterRegistration,
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

  it("moves past registration when a cold start lands on an account that exists", () => {
    useOnboardingStore.setState({
      currentStep: "registration",
      isAuthenticated: true,
      wasEmailRegistered: true,
    });

    resumeEmailUserAfterRegistration();

    expect(useOnboardingStore.getState().currentStep).toBe("income");
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
      isAuthenticated: false,
    });
    restoreOnboardingDraft();

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe("charges");
    expect(state.firstName).toBe("Maxime");
    expect(state.monthlyIncome).toBe(6500);
    expect(state.customTransactions).toHaveLength(1);
    expect(state.wasEmailRegistered).toBe(true);
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
