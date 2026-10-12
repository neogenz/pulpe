import Foundation
import SwiftUI

/// Device-local, account-scoped memory for the automatic feedback invitation: first on
/// the third active day, then every three active days until the account answers.
/// App versions are deliberately absent: updating Pulpe must not reset the history.
///
/// SAFETY: `UserDefaults` is thread-safe. Production calls this value from the main
/// actor; tests use isolated suites, so each read-modify-write sequence has one owner.
struct FeedbackPromptPreferences: @unchecked Sendable {
    static let activeDaysBetweenPrompts = 3

    private struct AccountState: Codable {
        var activeDayCount = 0
        var lastActiveDay: String?
        var lastPromptedAtActiveDayCount: Int?
        var promptCount = 0
        var hasSubmitted = false
    }

    private enum Key {
        // v1 counted a 7-day window and only remembered "prompted once". Its history
        // is dropped on purpose: the server is the source of truth for "answered".
        static let accountStates = "pulpe.feedback-prompt.v2.account-states"
    }

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func recordActiveDay(
        for userID: String,
        now: Date = Date(),
        calendar: Calendar = .current
    ) {
        let today = dayIdentifier(for: now, calendar: calendar)
        update(userID) { state in
            guard state.lastActiveDay != today else { return }
            state.lastActiveDay = today
            state.activeDayCount += 1
        }
    }

    func isEligible(for userID: String) -> Bool {
        let state = loadStates()[userID] ?? AccountState()
        guard !state.hasSubmitted,
              state.activeDayCount >= Self.activeDaysBetweenPrompts else { return false }
        guard let lastPrompt = state.lastPromptedAtActiveDayCount else { return true }
        return state.activeDayCount - lastPrompt >= Self.activeDaysBetweenPrompts
    }

    /// The 1-based number the next automatic invitation will carry, for analytics.
    func nextAutomaticPromptNumber(for userID: String) -> Int {
        (loadStates()[userID]?.promptCount ?? 0) + 1
    }

    /// Returns the 1-based number of this automatic invitation, for analytics.
    @discardableResult
    func markAutomaticPromptShown(for userID: String) -> Int {
        var promptNumber = 0
        update(userID) { state in
            state.lastPromptedAtActiveDayCount = state.activeDayCount
            state.promptCount += 1
            promptNumber = state.promptCount
        }
        return promptNumber
    }

    func markSubmitted(for userID: String) {
        update(userID) { $0.hasSubmitted = true }
    }

    private func update(_ userID: String, _ change: (inout AccountState) -> Void) {
        var states = loadStates()
        var state = states[userID] ?? AccountState()
        change(&state)
        states[userID] = state
        save(states)
    }

    private func dayIdentifier(for date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.era, .year, .month, .day], from: date)
        return [components.era, components.year, components.month, components.day]
            .map { String($0 ?? 0) }
            .joined(separator: "-")
    }

    private func loadStates() -> [String: AccountState] {
        guard let data = defaults.data(forKey: Key.accountStates),
              let states = try? decoder.decode([String: AccountState].self, from: data) else {
            return [:]
        }
        return states
    }

    private func save(_ states: [String: AccountState]) {
        guard let data = try? encoder.encode(states) else { return }
        defaults.set(data, forKey: Key.accountStates)
    }
}

extension EnvironmentValues {
    /// Transports RootView's presentation state to lower-priority feature prompts.
    /// RootView remains the single writer of the sheet/alert bindings themselves.
    @Entry var hasPriorityRootPresentation = false
}

struct AutomaticFeedbackPromptGate {
    let isSceneActive: Bool
    let isRestoringSession: Bool
    let isAuthenticated: Bool
    let isHomeAtRoot: Bool
    let hasBlockingPresentation: Bool
    let hasFinishedLoading: Bool
    let appVersionAllowsPresentation: Bool
    let whatsNewAllowsPresentation: Bool
    let isEligible: Bool

    var allowsPresentation: Bool {
        isSceneActive
            && !isRestoringSession
            && isAuthenticated
            && isHomeAtRoot
            && !hasBlockingPresentation
            && hasFinishedLoading
            && appVersionAllowsPresentation
            && whatsNewAllowsPresentation
            && isEligible
    }
}

/// Owns the two allowed evaluation moments: initial home load and an activation
/// after the scene entered background. State changes that unblock a presentation do not
/// trigger it, so a higher-priority sheet always defers feedback to the next use.
private struct AutomaticFeedbackPromptModifier: ViewModifier {
    @Environment(AppState.self) private var appState
    @Environment(AppVersionStore.self) private var appVersionStore
    @Environment(WhatsNewStore.self) private var whatsNewStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.hasPriorityRootPresentation) private var hasPriorityRootPresentation

    let contentState: CurrentMonthStore.ContentState
    let hasBlockingSheet: Bool
    let isNavigating: Bool
    let isPostOnboardingHandoffPresented: Bool
    /// Presents the invitation numbered by its argument when the live screen still
    /// allows it, and returns whether it did. Only a presented invitation is recorded.
    let onPresent: (Int) -> Bool

    @State private var hasEvaluatedInitialLoad = false
    @State private var hasPendingForegroundEvaluation = false
    @State private var backgroundReturnTracker = SceneBackgroundReturnTracker()
    private let preferences = FeedbackPromptPreferences()

    func body(content: Content) -> some View {
        content
            .onChange(of: contentState, initial: true) { _, newState in
                guard newState.hasFinishedLoading else { return }
                evaluateReadyMomentIfNeeded()
            }
            .onChange(of: appState.isRestoringSession, initial: true) { _, isRestoring in
                guard !isRestoring else { return }
                evaluateReadyMomentIfNeeded()
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard backgroundReturnTracker.consumeReturn(to: newPhase) else { return }
                hasPendingForegroundEvaluation = true
                // RootView prepares foreground restoration and routes pending deep links
                // from the same scene transition. Let those synchronous handlers publish
                // their source-of-truth state before evaluating this lower-priority prompt.
                Task { @MainActor in
                    await Task.yield()
                    evaluateReadyMomentIfNeeded()
                }
            }
    }

    private func evaluateReadyMomentIfNeeded() {
        guard contentState.hasFinishedLoading, !appState.isRestoringSession else { return }

        if hasPendingForegroundEvaluation {
            hasPendingForegroundEvaluation = false
            hasEvaluatedInitialLoad = true
            presentIfEligible()
            return
        }

        guard !hasEvaluatedInitialLoad else { return }
        hasEvaluatedInitialLoad = true
        // A foreground timeout can replace MainTabView with PIN and mount it again after
        // unlock. That remount is not a cold-start evaluation opportunity.
        guard appState.lastLockReason == .coldStart else { return }
        presentIfEligible()
    }

    private func presentIfEligible() {
        guard let userID = appState.currentUser?.id, allowsPresentation(for: userID) else { return }
        Task { @MainActor in
            guard await accountHasNotAnswered(userID),
                  allowsPresentation(for: userID),
                  onPresent(preferences.nextAutomaticPromptNumber(for: userID)) else { return }
            preferences.markAutomaticPromptShown(for: userID)
        }
    }

    private func allowsPresentation(for userID: String) -> Bool {
        AutomaticFeedbackPromptGate(
            isSceneActive: scenePhase == .active,
            isRestoringSession: appState.isRestoringSession,
            isAuthenticated: appState.authState == .authenticated
                && appState.currentRoute == .main
                && appState.currentUser?.id == userID,
            isHomeAtRoot: appState.selectedTab == .currentMonth && appState.currentMonthPath.isEmpty,
            hasBlockingPresentation: hasBlockingSheet
                || hasPriorityRootPresentation
                || isNavigating
                || isPostOnboardingHandoffPresented,
            hasFinishedLoading: contentState.hasFinishedLoading,
            appVersionAllowsPresentation: appVersionStore.allowsLowerPriorityPresentation,
            whatsNewAllowsPresentation: whatsNewStore.allowsLowerPriorityPresentation,
            isEligible: preferences.isEligible(for: userID)
        ).allowsPresentation
    }

    /// The account may have answered on another device or on the web. Fails closed:
    /// offline or erroring, nobody is invited.
    private func accountHasNotAnswered(_ userID: String) async -> Bool {
        guard let hasSubmitted = try? await FeedbackService.shared.hasSubmitted() else { return false }
        if hasSubmitted { preferences.markSubmitted(for: userID) }
        return !hasSubmitted
    }
}

private extension CurrentMonthStore.ContentState {
    var hasFinishedLoading: Bool {
        switch self {
        case .empty, .loaded: true
        case .idle, .loading, .failed: false
        }
    }
}

extension View {
    func automaticFeedbackPrompt(
        contentState: CurrentMonthStore.ContentState,
        hasBlockingSheet: Bool,
        isNavigating: Bool,
        isPostOnboardingHandoffPresented: Bool,
        onPresent: @escaping (Int) -> Bool
    ) -> some View {
        modifier(AutomaticFeedbackPromptModifier(
            contentState: contentState,
            hasBlockingSheet: hasBlockingSheet,
            isNavigating: isNavigating,
            isPostOnboardingHandoffPresented: isPostOnboardingHandoffPresented,
            onPresent: onPresent
        ))
    }
}

struct AutomaticFeedbackSheet: View {
    @Environment(AppState.self) private var appState
    let promptNumber: Int

    var body: some View {
        FeedbackSheet(source: .automatic(promptNumber: promptNumber)) {
            guard let userID = appState.currentUser?.id else { return }
            FeedbackPromptPreferences().markSubmitted(for: userID)
        }
    }
}
