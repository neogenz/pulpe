import XCTest
@testable import Pulpe

@MainActor
final class AccountRecoveryKeyTests: XCTestCase {

    func testVerifyAndRegenerate_whenVerificationFails_returnsIncorrectPasswordErrorFromClassification() async {
        // Given
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, _ in throw APIError.invalidCredentials },
                setupRecoveryKey: {
                    XCTFail("setupRecoveryKey should not be called when verification fails")
                    return "unused"
                }
            )
        )

        // When
        let error = await viewModel.verifyAndRegenerateRecoveryKey(
            password: "wrong-password",
            email: "john@doe.com"
        )

        // Then
        XCTAssertEqual(error, "Mot de passe incorrect")
        XCTAssertFalse(viewModel.isRegenerating)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertNil(viewModel.generatedRecoveryKey)
    }

    func testVerifyAndRegenerate_whenRegenerationFails_returnsGenerationError() async {
        // Given
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, _ in },
                setupRecoveryKey: {
                    throw APIError.networkError(URLError(.cannotConnectToHost))
                }
            )
        )

        // When
        let error = await viewModel.verifyAndRegenerateRecoveryKey(
            password: "current-password",
            email: "john@doe.com"
        )

        // Then
        XCTAssertEqual(error, "Erreur lors de la génération")
        XCTAssertFalse(viewModel.isRegenerating)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertNil(viewModel.generatedRecoveryKey)
    }

    func testVerifyAndRegenerate_whenSuccessful_setsRecoveryKeyState() async {
        // Given
        var verifyCallCount = 0
        var setupCallCount = 0
        let expectedRecoveryKey = "ABCD-EFGH-IJKL-MNOP"

        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, _ in verifyCallCount += 1 },
                setupRecoveryKey: {
                    setupCallCount += 1
                    return expectedRecoveryKey
                }
            )
        )

        // When
        let error = await viewModel.verifyAndRegenerateRecoveryKey(
            password: "current-password",
            email: "john@doe.com"
        )

        // Then
        XCTAssertNil(error)
        XCTAssertEqual(verifyCallCount, 1)
        XCTAssertEqual(setupCallCount, 1)
        XCTAssertEqual(viewModel.generatedRecoveryKey, expectedRecoveryKey)
        XCTAssertTrue(viewModel.showRecoveryKeySheet)
        XCTAssertFalse(viewModel.isRegenerating)
    }

    func testVerifyAndRegenerate_whenEmailMissing_returnsNotConnectedError() async {
        // Given
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, _ in XCTFail("verifyPassword should not be called") },
                setupRecoveryKey: {
                    XCTFail("setupRecoveryKey should not be called")
                    return "unused"
                }
            )
        )

        // When
        let error = await viewModel.verifyAndRegenerateRecoveryKey(
            password: "current-password",
            email: nil
        )

        // Then
        XCTAssertEqual(error, "Utilisateur non connecté")
        XCTAssertFalse(viewModel.isRegenerating)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertNil(viewModel.generatedRecoveryKey)
    }
}
