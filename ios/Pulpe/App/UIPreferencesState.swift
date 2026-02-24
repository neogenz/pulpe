import Foundation

private enum UserDefaultsKey {
    static let amountsHidden = "pulpe-amounts-hidden"
}

/// UI-only preferences state, separated from auth state for cleaner architecture.
/// Manages user preferences that don't affect authentication or security.
@Observable @MainActor
final class UIPreferencesState {
    // MARK: - Amount Visibility

    var amountsHidden: Bool = false {
        didSet {
            guard !isHydrating else { return }
            UserDefaults.standard.set(amountsHidden, forKey: UserDefaultsKey.amountsHidden)
        }
    }

    func toggleAmountsVisibility() {
        amountsHidden.toggle()
    }

    // MARK: - Private State

    private var isHydrating = false

    // MARK: - Initialization

    init() {
        isHydrating = true
        amountsHidden = UserDefaults.standard.bool(forKey: UserDefaultsKey.amountsHidden)
        isHydrating = false
    }
}
