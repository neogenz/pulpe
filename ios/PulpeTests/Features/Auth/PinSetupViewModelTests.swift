import Foundation
@testable import Pulpe
import Testing

@MainActor
struct PinSetupViewModelTests {
    private func makeSUT(mode: PinSetupMode = .chooseAndSetupRecovery) -> PinSetupViewModel {
        PinSetupViewModel(mode: mode)
    }

    // MARK: - Initial State

    @Test func initialState() {
        let sut = makeSUT()
        #expect(sut.digits.isEmpty)
        #expect(sut.isValidating == false)
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
        #expect(sut.recoveryKey == nil)
        #expect(sut.showRecoverySheet == false)
        #expect(sut.currentStep == .enterPin)
    }

    // MARK: - appendDigit

    @Test func appendDigit_addsDigit() {
        let sut = makeSUT()
        sut.appendDigit(3)
        #expect(sut.digits == [3])
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

    @Test func appendDigit_autoSubmitsAtMaxDigits() async {
        let sut = makeSUT()
        let stepHapticBefore = sut.hapticStepAdvance
        for i in 0..<sut.pinLength {
            sut.appendDigit(i)
        }

        // The last digit locks the numpad and schedules the submission.
        #expect(sut.isValidating == true)

        await waitForCondition("auto-submission never advanced the step") {
            sut.currentStep == .confirmPin
        }
        #expect(sut.digits.isEmpty)
        #expect(sut.hapticStepAdvance != stepHapticBefore)
    }

    @Test func appendDigit_belowMaxDigits_doesNotSubmit() async {
        let sut = makeSUT()
        for _ in 0..<(sut.pinLength - 1) {
            sut.appendDigit(1)
        }

        try? await Task.sleep(for: .milliseconds(300))

        #expect(sut.currentStep == .enterPin)
        #expect(sut.isValidating == false)
        #expect(sut.errorMessage == nil)
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
        sut.appendDigit(1)
        sut.deleteLastDigit()
        #expect(sut.isError == false)
        #expect(sut.errorMessage == nil)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.pinLength == 4)
    }
}

@MainActor
struct PinSetupFlowTests {
    private static let validSalt = String(repeating: "aa", count: 32)
    private static let validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    private func makeSUT(
        mode: PinSetupMode,
        hasRecoveryKey: Bool = false
    ) -> PinSetupTestSUT {
        let storage = StubClientKeyStorage()
        let encryptionAPI = StubEncryptionSetup(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: hasRecoveryKey
            ),
            beforeSetupRecovery: {
                #expect(await storage.storeCallCount == 1)
            }
        )
        let sut = PinSetupViewModel(
            mode: mode,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        return PinSetupTestSUT(sut: sut, encryptionAPI: encryptionAPI, storage: storage)
    }

    /// Types the digits and waits for the submission the last one auto-fires.
    private func submitPin(_ sut: PinSetupViewModel, digits: [Int] = [1, 2, 3, 4]) async {
        for digit in digits {
            sut.appendDigit(digit)
        }
        await waitForCondition("auto-submission never settled") { !sut.isValidating }
    }

    @Test("entry mode validates and never calls setup-recovery")
    func entryMode_doesNotCallSetupRecovery() async {
        let result = makeSUT(mode: .enterExistingPin)
        await submitPin(result.sut)

        #expect(await result.encryptionAPI.validateKeyCallCount == 1)
        #expect(await result.encryptionAPI.setupRecoveryCallCount == 0)
        #expect(await result.storage.storeCallCount == 1)
        #expect(result.sut.completedWithoutRecovery == true)
        #expect(result.sut.showRecoverySheet == false)
    }

    @Test("setup mode calls setup-recovery and shows recovery key")
    func setupMode_callsSetupRecovery() async {
        let result = makeSUT(mode: .chooseAndSetupRecovery)
        // Step 1: enter PIN
        await submitPin(result.sut)

        // Step 2: confirm PIN (same digits)
        await submitPin(result.sut)

        #expect(await result.encryptionAPI.validateKeyCallCount == 0)
        #expect(await result.encryptionAPI.setupRecoveryCallCount == 1)
        #expect(await result.storage.storeCallCount == 1)
        #expect(await result.storage.clearSessionCallCount == 0)
        #expect(result.sut.recoveryKey == "ABCD-EFGH-IJKL-MNOP")
        #expect(result.sut.showRecoverySheet == true)
        #expect(result.sut.completedWithoutRecovery == false)
    }

    @Test("a mismatched confirmation buzzes and returns to the first step")
    func mismatchedConfirmation_returnsToFirstStep() async {
        let result = makeSUT(mode: .chooseAndSetupRecovery)
        let errorHapticBefore = result.sut.hapticError

        await submitPin(result.sut, digits: [1, 2, 3, 4])
        #expect(result.sut.currentStep == .confirmPin)

        await submitPin(result.sut, digits: [4, 3, 2, 1])

        #expect(result.sut.currentStep == .enterPin)
        #expect(result.sut.isError == true)
        #expect(result.sut.errorMessage == "Les codes ne correspondent pas")
        #expect(result.sut.hapticError != errorHapticBefore)
        #expect(await result.encryptionAPI.setupRecoveryCallCount == 0)
    }

    @Test("mode titles are contextual")
    func modeTitles_areContextual() {
        #expect(PinSetupMode.chooseAndSetupRecovery.title == "Choisis ton code PIN")
        #expect(PinSetupMode.enterExistingPin.title == "Saisis ton code PIN")
    }

    @Test("clientKeyInvalid error shows specific PIN-exists message")
    func clientKeyInvalid_showsSpecificErrorMessage() async {
        let encryptionAPI = StubEncryptionSetup(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: false
            ),
            setupRecoveryError: APIError.clientKeyInvalid
        )
        let storage = StubClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: .chooseAndSetupRecovery,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        // Step 1: enter PIN
        await submitPin(sut)

        // Step 2: confirm PIN (atomic server setup detects the legacy vault)
        await submitPin(sut)

        #expect(sut.isError == true)
        #expect(sut.errorMessage == "Un code PIN existe déjà pour ce compte — saisis-le")
        #expect(await encryptionAPI.validateKeyCallCount == 0)
        #expect(await storage.storeCallCount == 1)
        #expect(await storage.clearSessionCallCount == 1)
    }

    @Test("generic API error shows generic error message")
    func genericAPIError_showsGenericErrorMessage() async {
        let encryptionAPI = StubEncryptionSetup(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: false
            ),
            setupRecoveryError: APIError.serverError(message: "Internal Server Error")
        )
        let storage = StubClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: .chooseAndSetupRecovery,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        // Step 1: enter PIN
        await submitPin(sut)

        // Step 2: confirm PIN (atomic server setup fails)
        await submitPin(sut)

        #expect(sut.isError == true)
        #expect(sut.errorMessage == "Une erreur est survenue, réessaie")
        #expect(await encryptionAPI.validateKeyCallCount == 0)
        #expect(await storage.storeCallCount == 1)
        #expect(await storage.clearSessionCallCount == 1)
    }
}

// MARK: - Stubs

private actor StubCryptoKeyDerivation: PinCryptoKeyDerivation {
    private let derivedKey: String

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private actor StubEncryptionSetup: PinEncryptionSetup {
    private let saltResponse: EncryptionSaltResponse
    private let validateKeyError: (any Error)?
    private let setupRecoveryError: (any Error)?
    private let beforeSetupRecovery: @Sendable () async -> Void
    private(set) var validateKeyCallCount = 0
    private(set) var setupRecoveryCallCount = 0

    init(
        saltResponse: EncryptionSaltResponse,
        validateKeyError: (any Error)? = nil,
        setupRecoveryError: (any Error)? = nil,
        beforeSetupRecovery: @escaping @Sendable () async -> Void = {}
    ) {
        self.saltResponse = saltResponse
        self.validateKeyError = validateKeyError
        self.setupRecoveryError = setupRecoveryError
        self.beforeSetupRecovery = beforeSetupRecovery
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {
        validateKeyCallCount += 1
        if let error = validateKeyError { throw error }
    }

    func setupRecoveryKey() async throws -> String {
        setupRecoveryCallCount += 1
        await beforeSetupRecovery()
        if let error = setupRecoveryError { throw error }
        return "ABCD-EFGH-IJKL-MNOP"
    }
}

private actor StubClientKeyStorage: PinClientKeySetupStorage {
    private(set) var storeCallCount = 0
    private(set) var clearSessionCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }

    func clearSession() async {
        clearSessionCallCount += 1
    }
}

private struct PinSetupTestSUT {
    let sut: PinSetupViewModel
    let encryptionAPI: StubEncryptionSetup
    let storage: StubClientKeyStorage
}
