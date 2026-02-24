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
        #expect(sut.canConfirm == false)
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

    @Test func appendDigit_stopsBeforeMaxToAvoidAutoComplete() {
        let sut = makeSUT()
        // Add up to maxDigits - 1 to avoid triggering completeSetup Task
        for i in 0..<(sut.maxDigits - 1) {
            sut.appendDigit(i)
        }
        #expect(sut.digits.count == sut.maxDigits - 1)
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
        #expect(sut.showRecoverySheet == false)
        #expect(sut.errorMessage == nil)
    }

    // MARK: - Constants

    @Test func constants() {
        let sut = makeSUT()
        #expect(sut.maxDigits == 6)
        #expect(sut.minDigits == 4)
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
        let encryptionAPI = StubEncryptionSetup(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: hasRecoveryKey
            )
        )
        let storage = StubClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: mode,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        return PinSetupTestSUT(sut: sut, encryptionAPI: encryptionAPI, storage: storage)
    }

    private func enterPin(_ sut: PinSetupViewModel, digits: [Int] = [1, 2, 3, 4]) {
        for digit in digits {
            sut.appendDigit(digit)
        }
    }

    @Test("entry mode validates and never calls setup-recovery")
    func entryMode_doesNotCallSetupRecovery() async {
        let result = makeSUT(mode: .enterExistingPin)
        enterPin(result.sut)

        await result.sut.confirm()

        #expect(result.encryptionAPI.setupRecoveryCallCount == 0)
        #expect(result.storage.storeCallCount == 1)
        #expect(result.sut.completedWithoutRecovery == true)
        #expect(result.sut.showRecoverySheet == false)
    }

    @Test("setup mode calls setup-recovery and shows recovery key")
    func setupMode_callsSetupRecovery() async {
        let result = makeSUT(mode: .chooseAndSetupRecovery)
        // Step 1: enter PIN
        enterPin(result.sut)
        await result.sut.confirm()

        // Step 2: confirm PIN (same digits)
        enterPin(result.sut)
        await result.sut.confirm()

        #expect(result.encryptionAPI.setupRecoveryCallCount == 1)
        #expect(result.storage.storeCallCount == 1)
        #expect(result.sut.recoveryKey == "ABCD-EFGH-IJKL-MNOP")
        #expect(result.sut.showRecoverySheet == true)
        #expect(result.sut.completedWithoutRecovery == false)
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
            validateKeyError: APIError.clientKeyInvalid
        )
        let storage = StubClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: .chooseAndSetupRecovery,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        // Step 1: enter PIN
        enterPin(sut)
        await sut.confirm()

        // Step 2: confirm PIN (triggers server validation which fails)
        enterPin(sut)
        await sut.confirm()

        #expect(sut.isError == true)
        #expect(sut.errorMessage == "Un code PIN existe déjà pour ce compte — saisis-le")
        #expect(storage.storeCallCount == 0)
    }

    @Test("generic API error shows generic error message")
    func genericAPIError_showsGenericErrorMessage() async {
        let encryptionAPI = StubEncryptionSetup(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: false
            ),
            validateKeyError: APIError.serverError(message: "Internal Server Error")
        )
        let storage = StubClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: .chooseAndSetupRecovery,
            cryptoService: StubCryptoKeyDerivation(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        // Step 1: enter PIN
        enterPin(sut)
        await sut.confirm()

        // Step 2: confirm PIN (triggers server validation which fails)
        enterPin(sut)
        await sut.confirm()

        #expect(sut.isError == true)
        #expect(sut.errorMessage == "Une erreur est survenue, réessaie")
        #expect(storage.storeCallCount == 0)
    }
}

// MARK: - Stubs

private final class StubCryptoKeyDerivation: PinCryptoKeyDerivation, @unchecked Sendable {
    private let derivedKey: String

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private final class StubEncryptionSetup: PinEncryptionSetup, @unchecked Sendable {
    private let saltResponse: EncryptionSaltResponse
    private let validateKeyError: (any Error)?
    private(set) var setupRecoveryCallCount = 0

    init(saltResponse: EncryptionSaltResponse, validateKeyError: (any Error)? = nil) {
        self.saltResponse = saltResponse
        self.validateKeyError = validateKeyError
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {
        if let error = validateKeyError { throw error }
    }

    func setupRecoveryKey() async throws -> String {
        setupRecoveryCallCount += 1
        return "ABCD-EFGH-IJKL-MNOP"
    }
}

private final class StubClientKeyStorage: PinClientKeyStorage, @unchecked Sendable {
    private(set) var storeCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}

private struct PinSetupTestSUT {
    let sut: PinSetupViewModel
    let encryptionAPI: StubEncryptionSetup
    let storage: StubClientKeyStorage
}
