import Foundation

/// Protocol for user settings API operations — enables store testing with mock doubles.
protocol UserSettingsServicing: Sendable {
    func getSettings() async throws -> UserSettings
    func updateSettings(_ settings: UpdateUserSettings) async throws -> UserSettings
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
