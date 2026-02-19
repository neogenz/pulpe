import Foundation
import Testing
@testable import Pulpe

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
    ) -> (
        sut: PinSetupViewModel,
        encryptionAPI: StubPinSetupEncryptionAPI,
        storage: StubPinSetupClientKeyStorage
    ) {
        let encryptionAPI = StubPinSetupEncryptionAPI(
            saltResponse: EncryptionSaltResponse(
                salt: Self.validSalt,
                kdfIterations: 1,
                hasRecoveryKey: hasRecoveryKey
            )
        )
        let storage = StubPinSetupClientKeyStorage()
        let sut = PinSetupViewModel(
            mode: mode,
            cryptoService: StubPinSetupCryptoService(derivedKey: Self.validKey),
            encryptionAPI: encryptionAPI,
            clientKeyManager: storage
        )
        return (sut, encryptionAPI, storage)
    }

    private func enterPin(_ sut: PinSetupViewModel, digits: [Int] = [1, 2, 3, 4]) {
        for digit in digits {
            sut.appendDigit(digit)
        }
    }

    @Test("entry mode validates and never calls setup-recovery")
    func entryMode_doesNotCallSetupRecovery() async {
        let (sut, encryptionAPI, storage) = makeSUT(mode: .enterExistingPin)
        enterPin(sut)

        await sut.confirm()

        #expect(encryptionAPI.setupRecoveryCallCount == 0)
        #expect(storage.storeCallCount == 1)
        #expect(sut.completedWithoutRecovery == true)
        #expect(sut.showRecoverySheet == false)
    }

    @Test("setup mode calls setup-recovery and shows recovery key")
    func setupMode_callsSetupRecovery() async {
        let (sut, encryptionAPI, storage) = makeSUT(mode: .chooseAndSetupRecovery)
        enterPin(sut)

        await sut.confirm()

        #expect(encryptionAPI.setupRecoveryCallCount == 1)
        #expect(storage.storeCallCount == 1)
        #expect(sut.recoveryKey == "ABCD-EFGH-IJKL-MNOP")
        #expect(sut.showRecoverySheet == true)
        #expect(sut.completedWithoutRecovery == false)
    }

    @Test("mode titles are contextual")
    func modeTitles_areContextual() {
        #expect(PinSetupMode.chooseAndSetupRecovery.title == "Choisis ton code PIN")
        #expect(PinSetupMode.enterExistingPin.title == "Saisis ton code PIN")
    }
}

// MARK: - Stubs

private final class StubPinSetupCryptoService: PinSetupCryptoKeyDerivation, @unchecked Sendable {
    private let derivedKey: String

    init(derivedKey: String) {
        self.derivedKey = derivedKey
    }

    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String {
        derivedKey
    }
}

private final class StubPinSetupEncryptionAPI: PinSetupEncryptionKeyValidation, @unchecked Sendable {
    private let saltResponse: EncryptionSaltResponse
    private(set) var setupRecoveryCallCount = 0

    init(saltResponse: EncryptionSaltResponse) {
        self.saltResponse = saltResponse
    }

    func getSalt() async throws -> EncryptionSaltResponse {
        saltResponse
    }

    func validateKey(_ clientKeyHex: String) async throws {}

    func setupRecoveryKey() async throws -> String {
        setupRecoveryCallCount += 1
        return "ABCD-EFGH-IJKL-MNOP"
    }
}

private final class StubPinSetupClientKeyStorage: PinSetupClientKeyStorage, @unchecked Sendable {
    private(set) var storeCallCount = 0

    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        storeCallCount += 1
    }
}
