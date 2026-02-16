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
}
