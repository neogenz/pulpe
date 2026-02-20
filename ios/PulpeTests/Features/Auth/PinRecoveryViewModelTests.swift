import Foundation
import Testing
@testable import Pulpe

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

    @Test func appendDigit_stopsBeforeMaxToAvoidAutoComplete() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for i in 0..<(sut.maxDigits - 1) {
            sut.appendDigit(i)
        }
        #expect(sut.digits.count == sut.maxDigits - 1)
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

    @Test func canConfirm_falseWithLessThanMinDigits() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for _ in 0..<(sut.minDigits - 1) {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == false)
    }

    @Test func canConfirm_trueAtMinDigits() {
        let sut = makeSUT()
        advanceToCreatePin(sut)
        for _ in 0..<sut.minDigits {
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
        #expect(sut.maxDigits == 6)
        #expect(sut.minDigits == 4)
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
        regenerateKey: String = "NEW-RECOVERY-KEY-1234"
    ) -> (
        sut: PinRecoveryViewModel,
        encryption: StubPinRecoveryEncryption,
        storage: StubPinRecoveryKeyStorage
    ) {
        let encryption = StubPinRecoveryEncryption(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: true
            ),
            recoverError: recoverError,
            regenerateKey: regenerateKey
        )
        let storage = StubPinRecoveryKeyStorage()
        let sut = PinRecoveryViewModel(
            cryptoService: StubPinRecoveryCrypto(derivedKey: Self.validKey),
            encryptionAPI: encryption,
            clientKeyManager: storage
        )
        return (sut, encryption, storage)
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
        let (sut, encryption, storage) = makeSUT()

        await enterRecoveryKeyAndMatchingPins(sut)

        #expect(storage.storeCallCount == 1)
        #expect(encryption.recoverCallCount == 1)
        #expect(encryption.regenerateCallCount == 1)
        #expect(sut.showRecoverySheet == true)
        #expect(sut.newRecoveryKey == "NEW-RECOVERY-KEY-1234")
    }

    @Test("invalid recovery key shows validation error")
    func invalidRecoveryKey_showsError() async {
        let (sut, _, _) = makeSUT(recoverError: .validationError(details: ["invalid"]))

        await enterRecoveryKeyAndMatchingPins(sut)

        #expect(sut.errorMessage == "Clé de récupération invalide — vérifie que tu as bien copié la clé")
        #expect(sut.step == .enterRecoveryKey)
    }

    @Test("network error resets to recovery key step")
    func networkError_resetsToRecoveryKeyStep() async {
        let (sut, _, _) = makeSUT(recoverError: .networkError(URLError(.notConnectedToInternet)))

        await enterRecoveryKeyAndMatchingPins(sut)

        #expect(sut.errorMessage == "Erreur de connexion, réessaie")
        #expect(sut.step == .enterRecoveryKey)
        #expect(sut.digits.isEmpty)
    }
}

// MARK: - Stubs

private final class StubPinRecoveryCrypto: PinRecoveryCryptoKeyDerivation, @unchecked Sendable {
    private let derivedKey: String

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private final class StubPinRecoveryEncryption: PinRecoveryEncryptionAPI, @unchecked Sendable {
    private let saltResponse: EncryptionSaltResponse
    private let recoverError: APIError?
    private let regenerateKey: String
    private(set) var recoverCallCount = 0
    private(set) var regenerateCallCount = 0

    init(
        saltResponse: EncryptionSaltResponse,
        recoverError: APIError? = nil,
        regenerateKey: String = "NEW-RECOVERY-KEY-1234"
    ) {
        self.saltResponse = saltResponse
        self.recoverError = recoverError
        self.regenerateKey = regenerateKey
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        saltResponse
    }

    func recover(recoveryKey: String, newClientKeyHex: String) async throws {
        recoverCallCount += 1
        if let error = recoverError { throw error }
    }

    func regenerateRecoveryKey() async throws -> String {
        regenerateCallCount += 1
        return regenerateKey
    }
}

private final class StubPinRecoveryKeyStorage: PinRecoveryClientKeyStorage, @unchecked Sendable {
    private(set) var storeCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}
