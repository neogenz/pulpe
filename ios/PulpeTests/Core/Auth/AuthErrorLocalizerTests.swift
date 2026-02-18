import Foundation
import Testing
@testable import Pulpe

struct AuthErrorLocalizerTests {

    @Test func classifyWithAPIErrorInvalidCredentialsReturnsInvalidCredentials() {
        // When
        let kind = AuthErrorLocalizer.classify(APIError.invalidCredentials)

        // Then
        #expect(kind == .invalidCredentials)
        #expect(AuthErrorLocalizer.isInvalidCredentials(APIError.invalidCredentials))
    }

    @Test func classifyWithSupabaseInvalidCredentialsMessageReturnsInvalidCredentials() {
        // Given
        let error = NSError(
            domain: "Supabase",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Invalid login credentials"]
        )

        // When
        let kind = AuthErrorLocalizer.classify(error)

        // Then
        #expect(kind == .invalidCredentials)
    }

    @Test func classifyWithNetworkErrorReturnsNetwork() {
        // When
        let kind = AuthErrorLocalizer.classify(
            APIError.networkError(URLError(.cannotConnectToHost))
        )

        // Then
        #expect(kind == .network)
    }

    @Test func classifyWithRateLimitedMessageReturnsRateLimited() {
        // Given
        let error = NSError(
            domain: "Supabase",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Too many requests"]
        )

        // When
        let kind = AuthErrorLocalizer.classify(error)

        // Then
        #expect(kind == .rateLimited)
    }

    @Test func localizeWithNetworkErrorReturnsLocalizedNetworkMessage() {
        // When
        let message = AuthErrorLocalizer.localize(
            APIError.networkError(URLError(.notConnectedToInternet))
        )

        // Then
        #expect(message == "Connexion impossible — vérifie ta connexion internet")
    }

    @Test func infoPlist_requiredRuntimeConfigKeysArePresent() throws {
        let info = try #require(loadAppInfoPlist())

        #expect((info["SUPABASE_URL"] as? String) != nil)
        #expect((info["SUPABASE_ANON_KEY"] as? String) != nil)
        #expect((info["API_BASE_URL"] as? String) != nil)
        #expect((info["APP_ENV"] as? String) != nil)
    }

    @Test func infoPlist_runtimeConfigUsesBuildSettingPlaceholders() throws {
        let info = try #require(loadAppInfoPlist())

        try assertPlaceholder(key: "SUPABASE_URL", expected: "$(SUPABASE_URL)", info: info)
        try assertPlaceholder(key: "API_BASE_URL", expected: "$(API_BASE_URL)", info: info)
        try assertPlaceholder(key: "SUPABASE_ANON_KEY", expected: "$(SUPABASE_ANON_KEY)", info: info)
        try assertPlaceholder(key: "APP_ENV", expected: "$(APP_ENV)", info: info)
    }

    private func assertPlaceholder(key: String, expected: String, info: [String: Any]) throws {
        let value = try #require(info[key] as? String)
        #expect(value == expected)
    }

    private func loadAppInfoPlist() -> [String: Any]? {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let iosRoot = testFileURL
            .deletingLastPathComponent() // Auth
            .deletingLastPathComponent() // Core
            .deletingLastPathComponent() // PulpeTests
            .deletingLastPathComponent() // ios

        let infoPlistURL = iosRoot.appendingPathComponent("Pulpe/Resources/Info.plist")
        return NSDictionary(contentsOf: infoPlistURL) as? [String: Any]
    }
}
