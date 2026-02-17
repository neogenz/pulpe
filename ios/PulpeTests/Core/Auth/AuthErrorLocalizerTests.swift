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

    @Test func releaseConfig_requiredKeysArePresentInInfoPlist() throws {
        let info = try #require(loadAppInfoPlist())

        let supabaseURL = info["SUPABASE_URL"] as? String
        #expect(supabaseURL != nil)
        #expect(!(supabaseURL ?? "").isEmpty)

        let supabaseAnonKey = info["SUPABASE_ANON_KEY"] as? String
        #expect(supabaseAnonKey != nil)
        #expect(!(supabaseAnonKey ?? "").isEmpty)

        let apiBaseURL = info["API_BASE_URL"] as? String
        #expect(apiBaseURL != nil)
        #expect(!(apiBaseURL ?? "").isEmpty)
    }

    @Test func releaseConfig_urlsAndValuesAreResolvedAndValid() throws {
        let info = try #require(loadAppInfoPlist())

        try assertResolvedURL(key: "SUPABASE_URL", info: info)
        try assertResolvedURL(key: "API_BASE_URL", info: info)

        let supabaseAnonKey = try #require(info["SUPABASE_ANON_KEY"] as? String)
        #expect(!supabaseAnonKey.contains("$("))
    }

    private func assertResolvedURL(key: String, info: [String: Any]) throws {
        let value = try #require(info[key] as? String)
        #expect(!value.contains("$("))

        let url = try #require(URL(string: value))
        #expect(url.scheme != nil)
        #expect(url.host != nil)
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
