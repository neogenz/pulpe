import Foundation

/// UI-only preferences state, separated from auth state for cleaner architecture.
/// Session-scoped: all preferences reset on app launch.
@Observable @MainActor
final class UIPreferencesState {
    // MARK: - Amount Visibility

    var amountsHidden: Bool = false

    func toggleAmountsVisibility() {
        amountsHidden.toggle()
    }
}
