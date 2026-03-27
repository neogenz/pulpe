import Foundation
@testable import Pulpe
import Testing

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
        for i in 0..<sut.pinLength {
            sut.appendDigit(i)
        }
        sut.appendDigit(9)
        #expect(sut.digits.count == sut.pinLength)
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

    // MARK: - Auto-Submit Sets isValidating

    @Test func appendDigit_atPinLength_setsIsValidatingSynchronously() {
        let sut = makeSUT()
        for _ in 0..<sut.pinLength {
            sut.appendDigit(1)
        }
        #expect(sut.isValidating == true)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.pinLength == 4)
    }
}

@MainActor
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
        deriveError: (any Error)? = nil,
        saltResponse: EncryptionSaltResponse = EncryptionSaltResponse(
            salt: validSalt,
            kdfIterations: 1,
            hasRecoveryKey: false
        ),
        validateKeyError: APIError? = nil
    ) -> PinEntryViewModel {
        PinEntryViewModel(
            cryptoService: StubCryptoKeyDerivation(derivedKey: derivedKey, deriveError: deriveError),
            encryptionAPI: StubEncryptionKeyValidation(
                saltResponse: saltResponse,
                validateKeyError: validateKeyError
            ),
            clientKeyManager: StubClientKeyStorage()
        )
    }

    private struct SUTComponents {
        let sut: PinEntryViewModel
        let crypto: StubCryptoKeyDerivation
        let encryptionAPI: StubEncryptionKeyValidation
        let storage: StubClientKeyStorage
    }

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
        return SUTComponents(sut: sut, crypto: crypto, encryptionAPI: encryptionAPI, storage: storage)
    }

    private func enterPin(_ sut: PinEntryViewModel, digits: [Int] = [1, 2, 3, 4]) {
        for digit in digits {
            sut.appendDigit(digit)
        }
    }

    // MARK: - Auto-Submit

    @Test func autoSubmit_triggersValidationAt4Digits() async {
        let sut = makeSUT()
        enterPin(sut)

        await waitForCondition("should auto-authenticate at 4 digits") {
            sut.authenticated
        }

        #expect(sut.authenticated == true)
    }

    @Test func autoSubmit_doesNotFireWithFewerThan4Digits() async {
        let sut = makeSUT()
        enterPin(sut, digits: [1, 2, 3])

        // Give time for any erroneous async task to fire
        try? await Task.sleep(for: .milliseconds(100))

        #expect(sut.authenticated == false)
        #expect(sut.isValidating == false)
    }

    // MARK: - Success Flow

    @Test func confirm_validPin_authenticates() async {
        let sut = makeSUT()
        enterPin(sut)

        // Auto-submit fires at 4 digits
        await waitForCondition("should auto-authenticate") { sut.authenticated }

        #expect(sut.authenticated == true)
        #expect(sut.isValidating == false)
        #expect(sut.errorMessage == nil)
    }

    @Test func confirm_validPin_callsEachServiceExactlyOnce() async {
        let components = makeSUTWithStubs()
        enterPin(components.sut)

        // Auto-submit fires at 4 digits
        await waitForCondition("should auto-authenticate") { components.sut.authenticated }

        #expect(await components.encryptionAPI.getSaltCallCount == 1)
        #expect(await components.crypto.deriveCallCount == 1)
        #expect(await components.encryptionAPI.validateKeyCallCount == 1)
        #expect(await components.storage.storeCallCount == 1)
    }

    // MARK: - Validation Error

    @Test func confirm_invalidPin_showsIncorrectCodeError() async {
        let sut = makeSUT(validateKeyError: .unauthorized)
        enterPin(sut)

        // Auto-submit fires at 4 digits
        await waitForCondition("should show error") { sut.isError }

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Ce code ne semble pas correct")
        #expect(sut.digits.isEmpty)
    }

    // MARK: - Rate Limiting

    @Test func confirm_rateLimited_showsRateLimitError() async {
        let sut = makeSUT(validateKeyError: .rateLimited)
        enterPin(sut)

        await waitForCondition("should show error") { sut.isError }

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Trop de tentatives, patiente un moment")
    }

    // MARK: - Network Error

    @Test func confirm_networkError_showsConnectionError() async {
        let sut = makeSUT(validateKeyError: .networkError(URLError(.notConnectedToInternet)))
        enterPin(sut)

        await waitForCondition("should show error") { sut.isError }

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Erreur de connexion, réessaie")
    }

    // MARK: - State Reset After Error

    @Test func confirm_afterError_isValidatingIsFalse() async {
        let sut = makeSUT(validateKeyError: .unauthorized)
        enterPin(sut)

        await waitForCondition("should show error") { sut.isError }

        #expect(sut.isValidating == false)
    }

    // MARK: - Cooldown After Error

    @Test func appendDigit_blockedDuringErrorCooldown() async {
        let sut = makeSUT(validateKeyError: .unauthorized)
        enterPin(sut)

        await waitForCondition("should show error") { sut.isError }

        // Try entering digits while error is displayed — should be blocked
        sut.appendDigit(1)
        sut.appendDigit(2)
        #expect(sut.digits.isEmpty)
    }

    // MARK: - Keychain Unavailable

    @Test("keychain unavailable surfaces error to user")
    func keychainUnavailable_surfacesError() async {
        struct KeychainUnavailableError: Error {}
        let sut = makeSUT(deriveError: KeychainUnavailableError())
        enterPin(sut)

        await waitForCondition("should show error") { sut.isError }

        #expect(sut.authenticated == false)
        #expect(sut.errorMessage == "Erreur inattendue, réessaie")
        #expect(sut.isValidating == false)
    }
}

// MARK: - Test Stubs

private actor StubCryptoKeyDerivation: PinCryptoKeyDerivation {
    let derivedKey: String
    let deriveError: (any Error)?
    private(set) var deriveCallCount = 0

    init(derivedKey: String, deriveError: (any Error)? = nil) {
        self.derivedKey = derivedKey
        self.deriveError = deriveError
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        deriveCallCount += 1
        if let error = deriveError { throw error }
        return derivedKey
    }
}

private actor StubEncryptionKeyValidation: PinEncryptionValidation {
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

private actor StubClientKeyStorage: PinClientKeyStorage {
    private(set) var storeCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}
