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
    func getSettingsWithDefaults(context: StaticString) async -> (payDay: Int?, currency: SupportedCurrency) {
        do {
            let settings = try await getSettings()
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
