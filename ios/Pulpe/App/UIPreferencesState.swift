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
            Task {
                await UserDefaultsStore.shared.setBool(amountsHidden, forKey: UserDefaultsKey.amountsHidden)
            }
        }
    }

    func toggleAmountsVisibility() {
        amountsHidden.toggle()
    }

    // MARK: - Initialization

    init() {
        // Load UserDefaults values asynchronously
        Task { @MainActor in
            amountsHidden = await UserDefaultsStore.shared.getBool(forKey: UserDefaultsKey.amountsHidden)
        }
    }
}
