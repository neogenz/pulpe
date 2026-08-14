import Foundation
import OSLog

/// Protocol for user settings API operations — enables store testing with mock doubles.
protocol UserSettingsServicing: Sendable {
    func getSettings() async throws -> UserSettings
    func updateSettings(_ settings: UpdateUserSettings) async throws -> UserSettings
}

extension UserSettingsServicing {
    /// Fetches settings and returns `(payDay, currency)` with defaults (`nil` payDay, `.chf` currency)
    /// when the network blips. Logs the failure with `context` so sync pipelines stay traceable.
    ///
    /// Also refreshes the persisted language, rather than handing it back: the callers are
    /// background and widget sync pipelines that never render it themselves — the widget
    /// process reads the snapshot. Returning it would give three call sites a binding to
    /// ignore and one more place to forget. A failed fetch leaves the snapshot alone: the
    /// last known language beats French while the network is down.
    func getSettingsWithDefaults(context: StaticString) async -> (payDay: Int?, currency: SupportedCurrency) {
        do {
            let settings = try await getSettings()
            // Only a real server preference lands in the snapshot: persisting the
            // French fallback would freeze device detection out on accounts that
            // have never chosen a language.
            if let locale = settings.locale {
                AppLocale.persist(locale)
            }
            return (settings.payDayOfMonth, settings.currency ?? .chf)
        } catch {
            Logger.sync.warning("\(context): settings fetch failed - \(error)")
            return (nil, .chf)
        }
    }
}

/// Service for user settings API operations
actor UserSettingsService: UserSettingsServicing {
    static let shared = UserSettingsService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    /// Fetch user settings (GET /users/settings)
    func getSettings() async throws -> UserSettings {
        try await apiClient.request(.userSettings, method: .get)
    }

    /// Update user settings (PUT /users/settings)
    func updateSettings(_ settings: UpdateUserSettings) async throws -> UserSettings {
        try await apiClient.request(.updateUserSettings, body: settings, method: .put)
    }
}
