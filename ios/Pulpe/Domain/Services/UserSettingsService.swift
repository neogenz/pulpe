import Foundation

/// Service for user settings API operations
actor UserSettingsService {
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
