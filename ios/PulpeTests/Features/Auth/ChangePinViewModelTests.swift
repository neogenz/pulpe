import Foundation
@testable import Pulpe
import Testing

// MARK: - Unit Tests (no DI)

@MainActor
struct ChangePinViewModelTests {
    private func makeSUT() -> ChangePinViewModel {
        ChangePinViewModel(
            cryptoService: StubChangePinCrypto(),
            encryptionAPI: StubChangePinEncryption(),
            clientKeyManager: StubChangePinStorage()
        )
    }

    // MARK: - Initial State

    @Test func initialState() {
        let sut = makeSUT()
        #expect(sut.step == .enterOldPin)
        #expect(sut.digits.isEmpty)
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
        #expect(sut.isProcessing == false)
        #expect(sut.recoveryKey == nil)
        #expect(sut.canConfirm == false)
        #expect(sut.pinLength == 4)
        #expect(sut.maxDigits == 4)
    }

    // MARK: - appendDigit

    @Test func appendDigit_addsDigit() {
        let sut = makeSUT()
        sut.appendDigit(5)
        #expect(sut.digits == [5])
    }

    @Test func appendDigit_stopsAtMax() {
        let sut = makeSUT()
        for i in 0..<sut.maxDigits { sut.appendDigit(i) }
        sut.appendDigit(9)
        #expect(sut.digits.count == sut.maxDigits)
    }

    // MARK: - deleteLastDigit

    @Test func deleteLastDigit_removesLast() {
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

    // MARK: - canConfirm

    @Test func canConfirm_falseWithLessThanPinLength() {
        let sut = makeSUT()
        for _ in 0..<(sut.pinLength - 1) { sut.appendDigit(1) }
        #expect(sut.canConfirm == false)
    }

    @Test func canConfirm_trueAtPinLength() {
        let sut = makeSUT()
        for _ in 0..<sut.pinLength { sut.appendDigit(1) }
        #expect(sut.canConfirm == true)
    }

    // MARK: - stepLabel

    @Test func stepLabel_matchesStep() {
        let sut = makeSUT()
        #expect(sut.stepLabel == "Étape 1 sur 2")
    }

    // MARK: - goBack

    @Test func goBack_fromNewPin_returnsToOldPin() async {
        let result = makeFlowSUT()
        await advanceToNewPinStep(result.sut)

        result.sut.goBack()

        #expect(result.sut.step == .enterOldPin)
        #expect(result.sut.digits.isEmpty)
        #expect(result.sut.isError == false)
    }
}

// MARK: - Test Constants

private enum ChangePinConstants {
    static let validSalt = String(repeating: "aa", count: 32)
    static let oldKey = "0000000000000000000000000000000000000000000000000000000000000000"
    static let newKey = "1111111111111111111111111111111111111111111111111111111111111111"
    static let recoveryKey = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGHH-IIJJ"
}

// MARK: - Flow Integration Tests (with DI)

@MainActor
struct ChangePinFlowTests {
    // MARK: - Happy Path

    @Test("successful PIN change stores new key and exposes recovery key")
    func successfulChange_storesKeyAndExposesRecoveryKey() async {
        let result = makeFlowSUT()

        await advanceToNewPinStep(result.sut)
        await enterNewPinAndConfirm(result.sut)

        #expect(result.sut.recoveryKey == ChangePinConstants.recoveryKey)
        #expect(await result.storage.storeCallCount == 2) // once for validate, once for change
        #expect(await result.storage.lastStoredKey == ChangePinConstants.newKey)
        #expect(await result.encryption.changePinCallCount == 1)
    }

    @Test("step transitions correctly through the flow")
    func stepTransitions() async {
        let result = makeFlowSUT()

        #expect(result.sut.step == .enterOldPin)
        #expect(result.sut.stepLabel == "Étape 1 sur 2")

        await advanceToNewPinStep(result.sut)

        #expect(result.sut.step == .enterNewPin)
        #expect(result.sut.stepLabel == "Étape 2 sur 2")
        #expect(result.sut.digits.isEmpty, "Digits should reset after step transition")
    }

    // MARK: - Old PIN Errors

    @Test("invalid old PIN shows error and stays on step 1")
    func invalidOldPin_showsError() async {
        let result = makeFlowSUT(validateKeyError: APIError.clientKeyInvalid)

        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.step == .enterOldPin)
        #expect(result.sut.errorMessage != nil)
        #expect(result.sut.isError == true)
        #expect(result.sut.digits.isEmpty)
    }

    @Test("rate limited on validate shows error")
    func rateLimited_onValidate_showsError() async {
        let result = makeFlowSUT(validateKeyError: APIError.rateLimited)

        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.step == .enterOldPin)
        #expect(result.sut.errorMessage == "Trop de tentatives, patiente un moment")
    }

    @Test("network error on validate shows error")
    func networkError_onValidate_showsError() async {
        let result = makeFlowSUT(
            getSaltError: APIError.networkError(URLError(.notConnectedToInternet))
        )

        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.step == .enterOldPin)
        #expect(result.sut.errorMessage == "Erreur de connexion, réessaie")
    }

    // MARK: - Same PIN (Client-Side)

    @Test("same PIN as old shows error and stays on step 2")
    func samePin_showsError() async {
        // Both old and new derive to the same key
        let result = makeFlowSUT(newDerivedKey: ChangePinConstants.oldKey)

        await advanceToNewPinStep(result.sut)
        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.step == .enterNewPin)
        #expect(result.sut.errorMessage == "Le nouveau code doit être différent")
        #expect(result.sut.digits.isEmpty)
        #expect(await result.encryption.changePinCallCount == 0, "Should not call API when same key")
    }

    // MARK: - Change PIN API Errors

    @Test("API error during change PIN goes back to step 2")
    func apiError_duringChange_goesToStep2() async {
        let result = makeFlowSUT(
            changePinError: APIError.serverError(message: "Internal error")
        )

        await advanceToNewPinStep(result.sut)
        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.step == .enterNewPin)
        #expect(result.sut.errorMessage != nil)
        #expect(result.sut.isProcessing == false)
    }

    @Test("rate limited during change PIN shows rate limit message")
    func rateLimited_duringChange_showsError() async {
        let result = makeFlowSUT(changePinError: APIError.rateLimited)

        await advanceToNewPinStep(result.sut)
        await enterPinAndConfirm(result.sut, digits: [1, 2, 3, 4])

        #expect(result.sut.errorMessage == "Trop de tentatives, patiente un moment")
    }

    // MARK: - clearRecoveryKey

    @Test("clearRecoveryKey nils out the recovery key")
    func clearRecoveryKey() async {
        let result = makeFlowSUT()
        await advanceToNewPinStep(result.sut)
        await enterNewPinAndConfirm(result.sut)

        #expect(result.sut.recoveryKey != nil)
        result.sut.clearRecoveryKey()
        #expect(result.sut.recoveryKey == nil)
    }

    // MARK: - No auto-confirm

    @Test("filling maxDigits does NOT auto-trigger confirm")
    func maxDigits_doesNotAutoTriggerConfirm() async {
        let result = makeFlowSUT()

        // Enter 4 digits (maxDigits) — should NOT auto-validate
        for i in 1...4 { result.sut.appendDigit(i) }

        // Give time for any erroneous async task to fire
        try? await Task.sleep(for: .milliseconds(100))

        #expect(result.sut.step == .enterOldPin, "Should stay on enterOldPin — no auto-confirm")
        #expect(result.sut.digits.count == 4)
    }
}

// MARK: - Helpers

@MainActor
private func makeFlowSUT(
    oldDerivedKey: String = ChangePinConstants.oldKey,
    newDerivedKey: String = ChangePinConstants.newKey,
    getSaltError: Error? = nil,
    validateKeyError: APIError? = nil,
    changePinError: APIError? = nil,
    recoveryKey: String = ChangePinConstants.recoveryKey
) -> ChangePinTestSUT {
    let crypto = StubChangePinCrypto(keys: [oldDerivedKey, newDerivedKey])
    let encryption = StubChangePinEncryption(
        saltResponse: EncryptionSaltResponse(
            salt: ChangePinConstants.validSalt,
            kdfIterations: 1,
            hasRecoveryKey: true
        ),
        getSaltError: getSaltError,
        validateKeyError: validateKeyError,
        changePinError: changePinError,
        recoveryKey: recoveryKey
    )
    let storage = StubChangePinStorage()
    let sut = ChangePinViewModel(
        cryptoService: crypto,
        encryptionAPI: encryption,
        clientKeyManager: storage
    )
    return ChangePinTestSUT(sut: sut, encryption: encryption, storage: storage)
}

@MainActor
private func enterPinAndConfirm(_ sut: ChangePinViewModel, digits: [Int]) async {
    for digit in digits { sut.appendDigit(digit) }
    await sut.confirm()
}

@MainActor
private func advanceToNewPinStep(_ sut: ChangePinViewModel) async {
    await enterPinAndConfirm(sut, digits: [1, 2, 3, 4])
    // Wait for async step transition
    await waitForCondition("should advance to enterNewPin") {
        sut.step == .enterNewPin
    }
}

@MainActor
private func enterNewPinAndConfirm(_ sut: ChangePinViewModel) async {
    await enterPinAndConfirm(sut, digits: [5, 6, 7, 8])
    // Wait for async processing
    await waitForCondition("should finish processing") {
        !sut.isProcessing
    }
}

// MARK: - Stubs

private actor StubChangePinCrypto: PinCryptoKeyDerivation {
    private let keys: [String]
    private var callIndex = 0

    init(keys: [String] = [String(repeating: "deadbeef", count: 8)]) {
        self.keys = keys
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        let key = keys[min(callIndex, keys.count - 1)]
        callIndex += 1
        return key
    }
}

private actor StubChangePinEncryption: PinEncryptionChangePin {
    private let saltResponse: EncryptionSaltResponse
    private let getSaltError: Error?
    private let validateKeyError: APIError?
    private let changePinError: APIError?
    private let recoveryKeyValue: String
    private(set) var changePinCallCount = 0

    init(
        saltResponse: EncryptionSaltResponse = EncryptionSaltResponse(
            salt: String(repeating: "aa", count: 32),
            kdfIterations: 1,
            hasRecoveryKey: true
        ),
        getSaltError: Error? = nil,
        validateKeyError: APIError? = nil,
        changePinError: APIError? = nil,
        recoveryKey: String = "MOCK-RECOVERY-KEY"
    ) {
        self.saltResponse = saltResponse
        self.getSaltError = getSaltError
        self.validateKeyError = validateKeyError
        self.changePinError = changePinError
        self.recoveryKeyValue = recoveryKey
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        if let error = getSaltError { throw error }
        return saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {
        if let error = validateKeyError { throw error }
    }

    func changePin(oldClientKeyHex: String, newClientKeyHex: String) async throws -> ChangePinResponse {
        changePinCallCount += 1
        if let error = changePinError { throw error }
        return ChangePinResponse(keyCheck: "mock-key-check", recoveryKey: recoveryKeyValue)
    }
}

private actor StubChangePinStorage: PinClientKeyStorage {
    private(set) var storeCallCount = 0
    private(set) var lastStoredKey: String?

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
        lastStoredKey = clientKeyHex
    }
}

private struct ChangePinTestSUT {
    let sut: ChangePinViewModel
    let encryption: StubChangePinEncryption
    let storage: StubChangePinStorage
}
