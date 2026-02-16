import XCTest
@testable import Pulpe

final class AuthErrorLocalizerTests: XCTestCase {

    func testClassify_withAPIErrorInvalidCredentials_returnsInvalidCredentials() {
        // When
        let kind = AuthErrorLocalizer.classify(APIError.invalidCredentials)

        // Then
        XCTAssertEqual(kind, .invalidCredentials)
        XCTAssertTrue(AuthErrorLocalizer.isInvalidCredentials(APIError.invalidCredentials))
    }

    func testClassify_withSupabaseInvalidCredentialsMessage_returnsInvalidCredentials() {
        // Given
        let error = NSError(
            domain: "Supabase",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Invalid login credentials"]
        )

        // When
        let kind = AuthErrorLocalizer.classify(error)

        // Then
        XCTAssertEqual(kind, .invalidCredentials)
    }

    func testClassify_withNetworkError_returnsNetwork() {
        // When
        let kind = AuthErrorLocalizer.classify(
            APIError.networkError(URLError(.cannotConnectToHost))
        )

        // Then
        XCTAssertEqual(kind, .network)
    }

    func testClassify_withRateLimitedMessage_returnsRateLimited() {
        // Given
        let error = NSError(
            domain: "Supabase",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Too many requests"]
        )

        // When
        let kind = AuthErrorLocalizer.classify(error)

        // Then
        XCTAssertEqual(kind, .rateLimited)
    }

    func testLocalize_withNetworkError_returnsLocalizedNetworkMessage() {
        // When
        let message = AuthErrorLocalizer.localize(
            APIError.networkError(URLError(.notConnectedToInternet))
        )

        // Then
        XCTAssertEqual(message, "Connexion impossible — vérifie ta connexion internet")
    }
}
