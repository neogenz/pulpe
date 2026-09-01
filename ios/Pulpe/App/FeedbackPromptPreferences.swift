import Foundation
import SwiftUI

/// Device-local, account-scoped memory for the one automatic feedback invitation.
/// App versions are deliberately absent: updating Pulpe must not reset the history.
///
/// SAFETY: `UserDefaults` is thread-safe. Production calls this value from the main
/// actor; tests use isolated suites, so each read-modify-write sequence has one owner.
struct FeedbackPromptPreferences: @unchecked Sendable {
    private struct AccountState: Codable {
        var firstUseAt: Date
        var activeDays: Set<String>
        var hasHandledAutomaticPrompt: Bool
    }

    private enum Key {
        static let accountStates = "pulpe.feedback-prompt.account-states"
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
        var states = loadStates()
        var state = states[userID] ?? AccountState(
            firstUseAt: now,
            activeDays: [],
            hasHandledAutomaticPrompt: false
        )
        state.activeDays.insert(dayIdentifier(for: now, calendar: calendar))
        state.activeDays.formIntersection(recentDayIdentifiers(at: now, calendar: calendar))
        states[userID] = state
        save(states)
    }

    func isEligible(
        for userID: String,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Bool {
        guard let state = loadStates()[userID],
              !state.hasHandledAutomaticPrompt,
              let threshold = calendar.date(byAdding: .day, value: 7, to: state.firstUseAt),
              now >= threshold else {
            return false
        }

        let recentDays = recentDayIdentifiers(at: now, calendar: calendar)
        return state.activeDays.intersection(recentDays).count >= 5
    }

    func markAutomaticPromptHandled(for userID: String, now: Date = Date()) {
        var states = loadStates()
        var state = states[userID] ?? AccountState(
            firstUseAt: now,
            activeDays: [],
            hasHandledAutomaticPrompt: false
        )
        guard !state.hasHandledAutomaticPrompt else { return }
        state.hasHandledAutomaticPrompt = true
        states[userID] = state
        save(states)
    }

    private func recentDayIdentifiers(at now: Date, calendar: Calendar) -> Set<String> {
        let today = calendar.startOfDay(for: now)
        return Set((0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: -offset, to: today)
                .map { dayIdentifier(for: $0, calendar: calendar) }
        })
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
    let onPresent: () -> Void

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
        guard let userID = appState.currentUser?.id else { return }
        let canPresent = AutomaticFeedbackPromptGate(
            isSceneActive: scenePhase == .active,
            isRestoringSession: appState.isRestoringSession,
            isAuthenticated: appState.authState == .authenticated && appState.currentRoute == .main,
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
        guard canPresent else { return }
        onPresent()
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
        onPresent: @escaping () -> Void
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
    private let preferences = FeedbackPromptPreferences()

    var body: some View {
        FeedbackSheet()
            .onAppear {
                guard let userID = appState.currentUser?.id else { return }
                preferences.markAutomaticPromptHandled(for: userID)
            }
    }
}
