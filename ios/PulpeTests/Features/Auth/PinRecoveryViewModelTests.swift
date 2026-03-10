// swiftlint:disable file_length
import Foundation
@testable import Pulpe
import Testing

@MainActor
struct PinRecoveryViewModelTests {
    private func makeSUT() -> PinRecoveryViewModel {
        PinRecoveryViewModel()
    }

    /// 52 valid Base32 characters (A-Z, 2-7)
    private let validRecoveryKey = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"

    /// Same key formatted with dashes (groups of 4)
    private var validRecoveryKeyFormatted: String {
        RecoveryKeyFormatter.format(validRecoveryKey)
    }

    // MARK: - Initial State

    @Test func initialState() {
        let sut = makeSUT()
        #expect(sut.step == .enterRecoveryKey)
        #expect(sut.digits.isEmpty)
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
        #expect(sut.isProcessing == false)
        #expect(sut.newRecoveryKey == nil)
        #expect(sut.showRecoverySheet == false)
        #expect(sut.showRecoveryKeyWarning == false)
        #expect(sut.recoveryKeyInput.isEmpty)
        #expect(sut.isRecoveryKeyValid == false)
        #expect(sut.canConfirm == false)
    }

    // MARK: - updateRecoveryKey

    @Test func updateRecoveryKey_formatsAndUppercases() {
        let sut = makeSUT()
        sut.updateRecoveryKey("abcd")
        #expect(sut.recoveryKeyInput == "ABCD")
    }

    @Test func updateRecoveryKey_insertsDashes() {
        let sut = makeSUT()
        sut.updateRecoveryKey("abcdefgh")
        #expect(sut.recoveryKeyInput == "ABCD-EFGH")
    }

    @Test func updateRecoveryKey_stripsNonBase32() {
        let sut = makeSUT()
        sut.updateRecoveryKey("AB01CD89")
        // 0, 1, 8, 9 are not Base32 (only A-Z, 2-7)
        #expect(sut.recoveryKeyInput == "ABCD")
    }

    @Test func updateRecoveryKey_clearsError() {
        let sut = makeSUT()
        // Set up some error state indirectly (via failed submit)
        sut.submitRecoveryKey()
        // Now clear via updateRecoveryKey
        sut.updateRecoveryKey("ABCD")
        #expect(sut.errorMessage == nil)
    }

    // MARK: - isRecoveryKeyValid

    @Test func isRecoveryKeyValid_exactly52Base32Chars_returnsTrue() {
        let sut = makeSUT()
        sut.updateRecoveryKey(validRecoveryKey)
        #expect(sut.isRecoveryKeyValid == true)
    }

    @Test func isRecoveryKeyValid_lessThan52Chars_returnsFalse() {
        let sut = makeSUT()
        sut.updateRecoveryKey("ABCDEFGHIJKLMNOP") // 16 chars
        #expect(sut.isRecoveryKeyValid == false)
    }

    @Test func isRecoveryKeyValid_moreThan52Chars_returnsFalse() {
        let sut = makeSUT()
        let longKey = validRecoveryKey + "EXTRA"
        sut.updateRecoveryKey(longKey)
        #expect(sut.isRecoveryKeyValid == false)
    }

    @Test func isRecoveryKeyValid_empty_returnsFalse() {
        let sut = makeSUT()
        #expect(sut.isRecoveryKeyValid == false)
    }

    @Test func isRecoveryKeyValid_withDashes_stillValid() {
        let sut = makeSUT()
        sut.updateRecoveryKey(validRecoveryKeyFormatted)
        #expect(sut.isRecoveryKeyValid == true)
    }

    // MARK: - submitRecoveryKey

    @Test func submitRecoveryKey_validKey_advancesToCreatePin() {
        let sut = makeSUT()
        sut.updateRecoveryKey(validRecoveryKey)
        sut.submitRecoveryKey()
        #expect(sut.step == .createPin)
        #expect(sut.errorMessage == nil)
    }

    @Test func submitRecoveryKey_invalidKey_staysOnEnterRecoveryKey() {
        let sut = makeSUT()
        sut.updateRecoveryKey("SHORT")
        sut.submitRecoveryKey()
        #expect(sut.step == .enterRecoveryKey)
    }

    // MARK: - appendDigit (PIN step)

    @Test func appendDigit_addsDigit() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.appendDigit(5)
        #expect(sut.digits == [5])
    }

    @Test func appendDigit_multipleDigits() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.appendDigit(1)
        sut.appendDigit(2)
        sut.appendDigit(3)
        #expect(sut.digits == [1, 2, 3])
    }

    @Test func appendDigit_respectsMaxDigits() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for i in 0..<sut.pinLength {
            sut.appendDigit(i)
        }
        sut.appendDigit(9)
        #expect(sut.digits.count == sut.pinLength)
    }

    @Test func appendDigit_noAutoSubmitAtMaxDigits() async {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for i in 0..<sut.pinLength {
            sut.appendDigit(i)
        }

        // Give time for any erroneous async task to fire
        try? await Task.sleep(for: .milliseconds(100))

        // Should still be on createPin step — no auto-submit
        #expect(sut.step == .createPin)
        #expect(sut.digits.count == sut.pinLength)
    }

    // MARK: - deleteLastDigit (PIN step)

    @Test func deleteLastDigit_removesLastDigit() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.appendDigit(1)
        sut.appendDigit(2)
        sut.deleteLastDigit()
        #expect(sut.digits == [1])
    }

    @Test func deleteLastDigit_noOpOnEmpty() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.deleteLastDigit()
        #expect(sut.digits.isEmpty)
    }

    @Test func deleteLastDigit_clearsErrorState() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.appendDigit(1)
        sut.deleteLastDigit()
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
    }

    // MARK: - canConfirm

    @Test func canConfirm_falseWithLessThanPinLength() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for _ in 0..<(sut.pinLength - 1) {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == false)
    }

    @Test func canConfirm_trueAtPinLength() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for _ in 0..<sut.pinLength {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == true)
    }

    // MARK: - goBack

    @Test func goBack_fromCreatePin_returnsToEnterRecoveryKey() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        sut.appendDigit(1)
        sut.appendDigit(2)
        sut.goBack()
        #expect(sut.step == .enterRecoveryKey)
        #expect(sut.digits.isEmpty)
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
    }

    @Test func goBack_fromEnterRecoveryKey_noOp() {
        let sut = makeSUT()
        sut.goBack()
        #expect(sut.step == .enterRecoveryKey)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.pinLength == 4)
    }

    // MARK: - confirmPin

    @Test func confirmPin_mismatchedPins_showsError() async {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
        #expect(sut.step == .confirmPin)

        for digit in [5, 6, 7, 8] { sut.appendDigit(digit) }
        await sut.confirmPin()
        #expect(sut.errorMessage == "Les codes ne correspondent pas")
        #expect(sut.step == .confirmPin)
    }

    // MARK: - goBack from confirmPin

    @Test func goBack_fromConfirmPin_returnsToCreatePin() async {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
        #expect(sut.step == .confirmPin)

        sut.goBack()
        #expect(sut.step == .createPin)
        #expect(sut.digits.isEmpty)
    }

    // MARK: - Helpers

    private func advanceToCreatePin(_ sut: PinRecoveryViewModel) {
        sut.updateRecoveryKey(validRecoveryKey)
        sut.submitRecoveryKey()
    }
}

// MARK: - Recovery Flow Integration Tests (with DI)

@MainActor
struct PinRecoveryFlowTests {
    private static let validSalt = String(repeating: "aa", count: 32)
    private static let validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    private static let validRecoveryKey = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"

    private func makeSUT(
        recoverError: APIError? = nil,
        getSaltError: Error? = nil,
        regenerateError: Error? = nil,
        regenerateKey: String = "NEW-RECOVERY-KEY-1234"
    ) -> PinRecoveryTestSUT {
        let encryption = StubPinRecoveryEncryption(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: true
            ),
            recoverError: recoverError,
            getSaltError: getSaltError,
            regenerateError: regenerateError,
            regenerateKey: regenerateKey
        )
        let storage = StubPinRecoveryKeyStorage()
        let sut = PinRecoveryViewModel(
            cryptoService: StubPinRecoveryCrypto(derivedKey: Self.validKey),
            encryptionAPI: encryption,
            clientKeyManager: storage
        )
        return PinRecoveryTestSUT(sut: sut, encryption: encryption, storage: storage)
    }

    private func enterRecoveryKeyAndMatchingPins(_ sut: PinRecoveryViewModel) async {
        sut.updateRecoveryKey(Self.validRecoveryKey)
        sut.submitRecoveryKey()
        // createPin step
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
        // confirmPin step (matching)
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
    }

    @Test("successful recovery stores key and shows recovery sheet")
    func successfulRecovery_storesKeyAndShowsSheet() async {
        let result = makeSUT()

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(await result.storage.storeCallCount == 1)
        #expect(await result.encryption.recoverCallCount == 1)
        #expect(await result.encryption.regenerateCallCount == 1)
        #expect(result.sut.showRecoverySheet == true)
        #expect(result.sut.newRecoveryKey == "NEW-RECOVERY-KEY-1234")
    }

    @Test("invalid recovery key shows validation error")
    func invalidRecoveryKey_showsError() async {
        let result = makeSUT(recoverError: .validationError(details: ["invalid"]))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.errorMessage == "Clé de récupération invalide — vérifie que tu as bien copié la clé")
        #expect(result.sut.step == .enterRecoveryKey)
    }

    @Test("network error stays on confirm pin step for retry")
    func networkError_staysOnConfirmPinStep() async {
        let result = makeSUT(recoverError: .networkError(URLError(.notConnectedToInternet)))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.errorMessage == "Erreur de connexion, réessaie")
        #expect(result.sut.step == .confirmPin)
        #expect(result.sut.digits.isEmpty)
    }

    @Test("getSalt failure stays on confirm pin with connection error")
    func getSaltFails_showsConnectionError() async {
        let result = makeSUT(getSaltError: APIError.networkError(URLError(.notConnectedToInternet)))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .confirmPin)
        #expect(result.sut.errorMessage == "Erreur de connexion, réessaie")
        #expect(result.sut.isProcessing == false)
    }

    @Test("regenerateRecoveryKey failure shows warning instead of sheet")
    func regenerateKeyFails_showsWarning() async {
        let result = makeSUT(regenerateError: APIError.serverError(message: "Internal Server Error"))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        // Recovery itself succeeded (key was stored)
        #expect(await result.storage.storeCallCount == 1)
        #expect(await result.encryption.recoverCallCount == 1)
        // But regenerateRecoveryKey failed, so warning shown instead of sheet
        #expect(result.sut.showRecoveryKeyWarning == true)
        #expect(result.sut.showRecoverySheet == false)
        #expect(result.sut.newRecoveryKey == nil)
    }
}

// MARK: - Bug 4: PIN Recovery Error Handling Regression Tests

/// Regression tests for Bug 4: PIN recovery error handling.
/// Verifies that each error type routes to the correct step:
/// - validationError: resets to recovery key step (key is invalid)
/// - networkError: stays on confirmPin step (retryable)
/// - rateLimited: stays on confirmPin step (retryable)
/// - generic error: stays on confirmPin step (retryable)
/// - retryFromCurrentStep preserves firstPin and recoveryKey
@MainActor
struct PinRecoveryErrorHandlingTests {
    private static let validSalt = String(repeating: "aa", count: 32)
    private static let validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    private static let validRecoveryKey = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"

    private func makeSUT(
        recoverError: APIError? = nil,
        getSaltError: Error? = nil
    ) -> PinRecoveryTestSUT {
        let encryption = StubPinRecoveryEncryption(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: true
            ),
            recoverError: recoverError,
            getSaltError: getSaltError
        )
        let storage = StubPinRecoveryKeyStorage()
        let sut = PinRecoveryViewModel(
            cryptoService: StubPinRecoveryCrypto(derivedKey: Self.validKey),
            encryptionAPI: encryption,
            clientKeyManager: storage
        )
        return PinRecoveryTestSUT(sut: sut, encryption: encryption, storage: storage)
    }

    private func enterRecoveryKeyAndMatchingPins(_ sut: PinRecoveryViewModel) async {
        sut.updateRecoveryKey(Self.validRecoveryKey)
        sut.submitRecoveryKey()
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
        for digit in [1, 2, 3, 4] { sut.appendDigit(digit) }
        await sut.confirmPin()
    }

    @Test("validationError resets to recovery key step (key is invalid)")
    func validationError_resetsToRecoveryKeyStep() async {
        let result = makeSUT(recoverError: .validationError(details: ["invalid key"]))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .enterRecoveryKey,
                "validationError must reset to enterRecoveryKey (the key itself is wrong)")
        #expect(result.sut.errorMessage != nil, "Should show error message")
        #expect(result.sut.digits.isEmpty, "Digits must be cleared after reset")
        #expect(result.sut.isProcessing == false)
    }

    @Test("networkError stays on confirmPin step (retryFromCurrentStep)")
    func networkError_staysOnConfirmPinStep() async {
        let result = makeSUT(recoverError: .networkError(URLError(.notConnectedToInternet)))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .confirmPin,
                "networkError must stay on confirmPin so user can retry without re-entering recovery key")
        #expect(result.sut.errorMessage == "Erreur de connexion, réessaie")
        #expect(result.sut.digits.isEmpty, "Digits must be cleared for retry")
        #expect(result.sut.isProcessing == false)
    }

    @Test("rateLimited stays on confirmPin step (retryFromCurrentStep)")
    func rateLimited_staysOnConfirmPinStep() async {
        let result = makeSUT(recoverError: .rateLimited)

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .confirmPin,
                "rateLimited must stay on confirmPin so user can retry later")
        #expect(result.sut.errorMessage == "Trop de tentatives, patiente un moment")
        #expect(result.sut.digits.isEmpty, "Digits must be cleared for retry")
        #expect(result.sut.isProcessing == false)
    }

    @Test("generic serverError stays on confirmPin step (retryFromCurrentStep)")
    func serverError_staysOnConfirmPinStep() async {
        let result = makeSUT(recoverError: .serverError(message: "Internal Server Error"))

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .confirmPin,
                "generic server error must stay on confirmPin so user can retry")
        #expect(result.sut.errorMessage == "Une erreur est survenue, réessaie")
        #expect(result.sut.digits.isEmpty, "Digits must be cleared for retry")
        #expect(result.sut.isProcessing == false)
    }

    @Test("unauthorized requires reauthentication and does not retry recovery flow")
    func unauthorized_requiresReauthentication() async {
        let result = makeSUT(recoverError: .unauthorized)

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(
            result.sut.requiresReauthentication == true,
            "401/unauthorized must require reauthentication instead of looping in recovery"
        )
        #expect(
            result.sut.errorMessage == "Ta session a expiré — reconnecte-toi",
            "Unauthorized should show a session-expired message"
        )
        #expect(result.sut.isProcessing == false)
    }

    @Test("forbidden requires reauthentication and does not retry recovery flow")
    func forbidden_requiresReauthentication() async {
        let result = makeSUT(recoverError: .forbidden)

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(
            result.sut.requiresReauthentication == true,
            "403/forbidden must require reauthentication instead of looping in recovery"
        )
        #expect(
            result.sut.errorMessage == "Ta session a expiré — reconnecte-toi",
            "Forbidden should show a session-expired message"
        )
        #expect(result.sut.isProcessing == false)
    }

    @Test("non-API error stays on confirmPin step (catch-all handler)")
    func nonAPIError_staysOnConfirmPinStep() async {
        struct SimulatedNonAPIError: Error {}

        let result = makeSUT(getSaltError: SimulatedNonAPIError())

        await enterRecoveryKeyAndMatchingPins(result.sut)

        #expect(result.sut.step == .confirmPin,
                "non-API error must stay on confirmPin via the catch-all handler")
        #expect(result.sut.errorMessage == "Une erreur est survenue, réessaie")
        #expect(result.sut.isProcessing == false)
    }

    @Test("retryFromCurrentStep after rateLimited allows re-entering PIN without recovery key")
    func retryFromCurrentStep_preservesRecoveryKeyAndFirstPin() async {
        let result = makeSUT(recoverError: .rateLimited)

        // Enter recovery key and PINs
        result.sut.updateRecoveryKey(Self.validRecoveryKey)
        result.sut.submitRecoveryKey()
        for digit in [1, 2, 3, 4] { result.sut.appendDigit(digit) }
        await result.sut.confirmPin()
        #expect(result.sut.step == .confirmPin, "Setup: should be on confirmPin after createPin")

        // Trigger recovery which fails with rateLimited
        for digit in [1, 2, 3, 4] { result.sut.appendDigit(digit) }
        await result.sut.confirmPin()

        // rateLimited: retryFromCurrentStep keeps firstPin and recoveryKey
        #expect(result.sut.step == .confirmPin, "Should stay on confirmPin for retry")
        #expect(result.sut.digits.isEmpty, "Digits cleared for re-entry")

        // The recovery key input should still be populated (not cleared)
        // because retryFromCurrentStep does NOT clear recoveryKeyInput
        #expect(result.sut.recoveryKeyInput.isEmpty == false,
                "recoveryKeyInput must be preserved so user doesn't have to re-enter it")
    }
}

// MARK: - Stubs

private actor StubPinRecoveryCrypto: PinCryptoKeyDerivation {
    private let derivedKey: String

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private actor StubPinRecoveryEncryption: PinEncryptionRecovery {
    private let saltResponse: EncryptionSaltResponse
    private let recoverError: APIError?
    private let getSaltError: Error?
    private let regenerateError: Error?
    private let regenerateKey: String
    private(set) var recoverCallCount = 0
    private(set) var regenerateCallCount = 0

    init(
        saltResponse: EncryptionSaltResponse,
        recoverError: APIError? = nil,
        getSaltError: Error? = nil,
        regenerateError: Error? = nil,
        regenerateKey: String = "NEW-RECOVERY-KEY-1234"
    ) {
        self.saltResponse = saltResponse
        self.recoverError = recoverError
        self.getSaltError = getSaltError
        self.regenerateError = regenerateError
        self.regenerateKey = regenerateKey
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        if let error = getSaltError { throw error }
        return saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {
        // No-op for recovery tests
    }

    func recover(recoveryKey: String, newClientKeyHex: String) async throws {
        recoverCallCount += 1
        if let error = recoverError { throw error }
    }

    func regenerateRecoveryKey() async throws -> String {
        regenerateCallCount += 1
        if let error = regenerateError { throw error }
        return regenerateKey
    }
}

private actor StubPinRecoveryKeyStorage: PinClientKeyStorage {
    private(set) var storeCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}

private struct PinRecoveryTestSUT {
    let sut: PinRecoveryViewModel
    let encryption: StubPinRecoveryEncryption
    let storage: StubPinRecoveryKeyStorage
}
