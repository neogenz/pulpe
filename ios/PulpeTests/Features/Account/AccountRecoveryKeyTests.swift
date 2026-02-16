import Testing
@testable import Pulpe

@MainActor
struct AccountRecoveryKeyTests {

    @Test func verifyAndRegenerate_whenVerificationFails_returnsIncorrectPasswordErrorFromClassification() async {
        // Given
        var capturedEmail: String?
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, email in
                    capturedEmail = email
                    throw APIError.invalidCredentials
                },
                setupRecoveryKey: {
                    Issue.record("setupRecoveryKey should not be called when verification fails")
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
        #expect(capturedEmail == "john@doe.com")
        #expect(error == "Mot de passe incorrect")
        #expect(!viewModel.isRegenerating)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(viewModel.generatedRecoveryKey == nil)
    }

    @Test func verifyAndRegenerate_whenRegenerationFails_returnsGenerationError() async {
        // Given
        var capturedEmail: String?
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, email in capturedEmail = email },
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
        #expect(capturedEmail == "john@doe.com")
        #expect(error == "Erreur lors de la génération")
        #expect(!viewModel.isRegenerating)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(viewModel.generatedRecoveryKey == nil)
    }

    @Test func verifyAndRegenerate_whenSuccessful_setsRecoveryKeyState() async {
        // Given
        var verifyCallCount = 0
        var setupCallCount = 0
        var capturedEmail: String?
        let expectedRecoveryKey = "ABCD-EFGH-IJKL-MNOP"

        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, email in
                    verifyCallCount += 1
                    capturedEmail = email
                },
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
        #expect(error == nil)
        #expect(capturedEmail == "john@doe.com")
        #expect(verifyCallCount == 1)
        #expect(setupCallCount == 1)
        #expect(viewModel.generatedRecoveryKey == expectedRecoveryKey)
        #expect(viewModel.showRecoveryKeySheet)
        #expect(!viewModel.isRegenerating)
    }

    @Test func verifyAndRegenerate_whenEmailMissing_returnsNotConnectedError() async {
        // Given
        let viewModel = AccountSecurityViewModel(
            dependencies: AccountSecurityDependencies(
                verifyPassword: { _, _ in Issue.record("verifyPassword should not be called") },
                setupRecoveryKey: {
                    Issue.record("setupRecoveryKey should not be called")
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
        #expect(error == "Utilisateur non connecté")
        #expect(!viewModel.isRegenerating)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(viewModel.generatedRecoveryKey == nil)
    }
}
