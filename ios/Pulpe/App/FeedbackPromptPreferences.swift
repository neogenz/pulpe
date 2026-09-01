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

/// Owns the two allowed evaluation moments: initial home load and a genuine
/// background-to-active return. State changes that unblock a presentation do not
/// trigger it, so a higher-priority sheet always defers feedback to the next use.
private struct AutomaticFeedbackPromptModifier: ViewModifier {
    @Environment(AppState.self) private var appState
    @Environment(AppVersionStore.self) private var appVersionStore
    @Environment(WhatsNewStore.self) private var whatsNewStore
    @Environment(\.scenePhase) private var scenePhase

    let contentState: CurrentMonthStore.ContentState
    let hasBlockingSheet: Bool
    let isNavigating: Bool
    let isPostOnboardingHandoffPresented: Bool
    let onPresent: () -> Void

    @State private var hasEvaluatedInitialLoad = false
    private let preferences = FeedbackPromptPreferences()

    func body(content: Content) -> some View {
        content
            .onChange(of: contentState, initial: true) { _, newState in
                guard newState.hasFinishedLoading, !hasEvaluatedInitialLoad else { return }
                hasEvaluatedInitialLoad = true
                presentIfEligible()
            }
            .onChange(of: scenePhase) { oldPhase, newPhase in
                guard oldPhase == .background, newPhase == .active else { return }
                presentIfEligible()
            }
    }

    private func presentIfEligible() {
        guard scenePhase == .active,
              appState.selectedTab == .currentMonth,
              appState.currentMonthPath.isEmpty,
              !hasBlockingSheet,
              !isNavigating,
              contentState.hasFinishedLoading,
              appVersionStore.allowsLowerPriorityPresentation,
              whatsNewStore.allowsLowerPriorityPresentation,
              !isPostOnboardingHandoffPresented,
              let userID = appState.currentUser?.id,
              preferences.isEligible(for: userID) else {
            return
        }
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
