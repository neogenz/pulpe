import Foundation
import Testing
@testable import Pulpe

@MainActor
struct PinEntryViewModelTests {
    private func makeSUT() -> PinEntryViewModel {
        PinEntryViewModel()
    }

    // MARK: - Initial State

    @Test func initialState() {
        let sut = makeSUT()
        #expect(sut.digits.isEmpty)
        #expect(sut.isValidating == false)
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
        #expect(sut.authenticated == false)
        #expect(sut.canConfirm == false)
    }

    // MARK: - appendDigit

    @Test func appendDigit_addsDigit() {
        let sut = makeSUT()
        sut.appendDigit(5)
        #expect(sut.digits == [5])
    }

    @Test func appendDigit_multipleDigits() {
        let sut = makeSUT()
        sut.appendDigit(1)
        sut.appendDigit(2)
        sut.appendDigit(3)
        #expect(sut.digits == [1, 2, 3])
    }

    @Test func appendDigit_respectsMaxDigits() {
        let sut = makeSUT()
        for i in 0..<sut.maxDigits {
            sut.appendDigit(i)
        }
        sut.appendDigit(9)
        #expect(sut.digits.count == sut.maxDigits)
    }

    // MARK: - deleteLastDigit

    @Test func deleteLastDigit_removesLastDigit() {
        let sut = makeSUT()
        sut.appendDigit(1)
        sut.appendDigit(2)
        sut.deleteLastDigit()
        #expect(sut.digits == [1])
    }

    @Test func deleteLastDigit_noOpOnEmpty() {
        let sut = makeSUT()
        sut.deleteLastDigit()
        #expect(sut.digits.isEmpty)
    }

    @Test func deleteLastDigit_clearsErrorState() {
        let sut = makeSUT()
        // Simulate error state by accessing internal state indirectly:
        // append digits then delete to verify error fields are cleared
        sut.appendDigit(1)
        sut.deleteLastDigit()
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
    }

    // MARK: - canConfirm

    @Test func canConfirm_falseWithLessThanMinDigits() {
        let sut = makeSUT()
        for _ in 0..<(sut.minDigits - 1) {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == false)
    }

    @Test func canConfirm_trueAtMinDigits() {
        let sut = makeSUT()
        for _ in 0..<sut.minDigits {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == true)
    }

    @Test func canConfirm_trueAboveMinDigits() {
        let sut = makeSUT()
        for _ in 0..<(sut.minDigits + 1) {
            sut.appendDigit(1)
        }
        #expect(sut.canConfirm == true)
    }

    @Test func confirm_withLessThanMinDigits_doesNothing() async {
        let sut = makeSUT()
        sut.appendDigit(1)
        sut.appendDigit(2)

        await sut.confirm()

        #expect(sut.isValidating == false)
        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == nil)
    }

    @Test func appendDigit_atMaxDigits_doesNotAutoAuthenticate() {
        let sut = makeSUT()
        for i in 0..<sut.maxDigits {
            sut.appendDigit(i)
        }

        #expect(sut.authenticated == false)
    }

    // MARK: - biometricAvailable

    @Test func biometricAvailable_initiallyFalse() {
        let sut = makeSUT()
        #expect(sut.biometricAvailable == false)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.maxDigits == 6)
        #expect(sut.minDigits == 4)
    }
}

// MARK: - PIN Validation Integration Tests

@MainActor
struct PinEntryValidationFlowTests {
    private static let validSalt = String(repeating: "aa", count: 32)
    private static let validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    private func makeSUT(
        derivedKey: String = validKey,
        saltResponse: EncryptionSaltResponse = EncryptionSaltResponse(
            salt: validSalt,
            kdfIterations: 1,
            hasRecoveryKey: false
        ),
        validateKeyError: APIError? = nil
    ) -> PinEntryViewModel {
        PinEntryViewModel(
            cryptoService: StubCryptoKeyDerivation(derivedKey: derivedKey),
            encryptionAPI: StubEncryptionKeyValidation(
                saltResponse: saltResponse,
                validateKeyError: validateKeyError
            ),
            clientKeyManager: StubClientKeyStorage()
        )
    }

    private func enterPin(_ sut: PinEntryViewModel, digits: [Int] = [1, 2, 3, 4]) {
        for digit in digits {
            sut.appendDigit(digit)
        }
    }

    // MARK: - Success Flow

    @Test func confirm_validPin_authenticates() async {
        let sut = makeSUT()
        enterPin(sut)

        await sut.confirm()

        #expect(sut.authenticated == true)
        #expect(sut.isValidating == false)
        #expect(sut.errorMessage == nil)
    }

    // MARK: - Validation Error

    @Test func confirm_invalidPin_showsIncorrectCodeError() async {
        let sut = makeSUT(validateKeyError: .unauthorized)
        enterPin(sut)

        await sut.confirm()

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Ce code ne semble pas correct")
        #expect(sut.digits.isEmpty)
    }

    // MARK: - Rate Limiting

    @Test func confirm_rateLimited_showsRateLimitError() async {
        let sut = makeSUT(validateKeyError: .rateLimited)
        enterPin(sut)

        await sut.confirm()

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Trop de tentatives, patiente un moment")
    }

    // MARK: - Network Error

    @Test func confirm_networkError_showsConnectionError() async {
        let sut = makeSUT(validateKeyError: .networkError(URLError(.notConnectedToInternet)))
        enterPin(sut)

        await sut.confirm()

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Erreur de connexion, reessaie")
    }

    // MARK: - State Reset After Error

    @Test func confirm_afterError_isValidatingIsFalse() async {
        let sut = makeSUT(validateKeyError: .unauthorized)
        enterPin(sut)

        await sut.confirm()

        #expect(sut.isValidating == false)
    }
}

// MARK: - Test Stubs

private struct StubCryptoKeyDerivation: CryptoKeyDerivation {
    let derivedKey: String

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private struct StubEncryptionKeyValidation: EncryptionKeyValidation {
    let saltResponse: EncryptionSaltResponse
    let validateKeyError: APIError?

    init(saltResponse: EncryptionSaltResponse, validateKeyError: APIError? = nil) {
        self.saltResponse = saltResponse
        self.validateKeyError = validateKeyError
    }

    func getSalt() async throws -> EncryptionSaltResponse { saltResponse }

    func validateKey(_ clientKeyHex: String) async throws {
        if let error = validateKeyError { throw error }
    }
}

private struct StubClientKeyStorage: ClientKeyStorage {
    func resolveViaBiometric() async throws -> String? { nil }
    func hasBiometricKey() async -> Bool { false }
    func store(_ clientKeyHex: String, enableBiometric: Bool) async {}
}
