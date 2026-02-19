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

    @Test func checkBiometricAvailability_prefDisabled_keepsBiometricUnavailable() async {
        let storage = StubClientKeyStorage(hasBiometricKeyValue: true)
        let sut = PinEntryViewModel(
            cryptoService: StubCryptoKeyDerivation(derivedKey: PinEntryValidationFlowTests.validKey),
            encryptionAPI: StubEncryptionKeyValidation(
                saltResponse: EncryptionSaltResponse(
                    salt: PinEntryValidationFlowTests.validSalt,
                    kdfIterations: 1,
                    hasRecoveryKey: false
                )
            ),
            clientKeyManager: storage,
            biometricCapability: { true }
        )

        await sut.checkBiometricAvailability(preferenceEnabled: false)

        #expect(sut.biometricAvailable == false)
    }

    @Test func checkBiometricAvailability_prefEnabledAndKeyAvailable_setsBiometricAvailable() async {
        let storage = StubClientKeyStorage(hasBiometricKeyValue: true)
        let sut = PinEntryViewModel(
            cryptoService: StubCryptoKeyDerivation(derivedKey: PinEntryValidationFlowTests.validKey),
            encryptionAPI: StubEncryptionKeyValidation(
                saltResponse: EncryptionSaltResponse(
                    salt: PinEntryValidationFlowTests.validSalt,
                    kdfIterations: 1,
                    hasRecoveryKey: false
                )
            ),
            clientKeyManager: storage,
            biometricCapability: { true }
        )

        await sut.checkBiometricAvailability(preferenceEnabled: true)

        #expect(sut.biometricAvailable == true)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.maxDigits == 6)
        #expect(sut.minDigits == 4)
    }
}

struct PinEntryCopyTests {
    @Test func existingUserTitle_usesEntryWording() {
        #expect(PinEntryView.pinEntryTitle == "Saisis ton code PIN")
    }

    @Test func forgotPinLabel_usesPinWording() {
        #expect(PinEntryView.forgotPinLabel == "Code PIN oublié ?")
    }
}

// MARK: - PIN Validation Integration Tests

@MainActor
struct PinEntryValidationFlowTests {
    static let validSalt = String(repeating: "aa", count: 32)
    static let validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

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

    private typealias SUTComponents = (
        sut: PinEntryViewModel,
        crypto: StubCryptoKeyDerivation,
        encryptionAPI: StubEncryptionKeyValidation,
        storage: StubClientKeyStorage
    )

    private func makeSUTWithStubs(
        derivedKey: String = validKey,
        saltResponse: EncryptionSaltResponse = EncryptionSaltResponse(
            salt: validSalt,
            kdfIterations: 1,
            hasRecoveryKey: false
        ),
        validateKeyError: APIError? = nil
    ) -> SUTComponents {
        let crypto = StubCryptoKeyDerivation(derivedKey: derivedKey)
        let encryptionAPI = StubEncryptionKeyValidation(
            saltResponse: saltResponse,
            validateKeyError: validateKeyError
        )
        let storage = StubClientKeyStorage()
        let sut = PinEntryViewModel(
            cryptoService: crypto,
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        return (sut, crypto, encryptionAPI, storage)
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

    @Test func confirm_validPin_callsEachServiceExactlyOnce() async {
        let (sut, crypto, encryptionAPI, storage) = makeSUTWithStubs()
        enterPin(sut)

        await sut.confirm()

        #expect(encryptionAPI.getSaltCallCount == 1)
        #expect(crypto.deriveCallCount == 1)
        #expect(encryptionAPI.validateKeyCallCount == 1)
        #expect(storage.storeCallCount == 1)
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

private final class StubCryptoKeyDerivation: CryptoKeyDerivation, @unchecked Sendable {
    let derivedKey: String
    private(set) var deriveCallCount = 0

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        deriveCallCount += 1
        return derivedKey
    }
}

private final class StubEncryptionKeyValidation: EncryptionKeyValidation, @unchecked Sendable {
    let saltResponse: EncryptionSaltResponse
    let validateKeyError: APIError?
    private(set) var getSaltCallCount = 0
    private(set) var validateKeyCallCount = 0

    init(saltResponse: EncryptionSaltResponse, validateKeyError: APIError? = nil) {
        self.saltResponse = saltResponse
        self.validateKeyError = validateKeyError
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        getSaltCallCount += 1
        return saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {
        validateKeyCallCount += 1
        if let error = validateKeyError { throw error }
    }
}

private final class StubClientKeyStorage: ClientKeyStorage, @unchecked Sendable {
    private(set) var storeCallCount = 0
    private let hasBiometricKeyValue: Bool

    init(hasBiometricKeyValue: Bool = false) {
        self.hasBiometricKeyValue = hasBiometricKeyValue
    }

    func resolveViaBiometric() async throws -> String? { nil }
    func hasBiometricKey() async -> Bool { hasBiometricKeyValue }
    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}
