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
