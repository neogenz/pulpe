import Foundation
import Testing
@testable import Pulpe

struct CryptoServiceTests {
    private let sut = CryptoService.shared
    private let validSalt = "aa" * 32 // 64-char hex
    
    /// Valid iteration count within bounds (uses minimum for faster tests)
    private let validIterations = CryptoService.minIterations

    /// Test-only demo client key for validation tests
    private static let demoClientKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    // MARK: - deriveClientKey

    @Test func deriveClientKey_validInputs_returns64CharHex() async throws {
        let key = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: validIterations)
        #expect(key.count == 64)
        #expect(key.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil)
    }

    @Test func deriveClientKey_deterministic() async throws {
        let key1 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: validIterations)
        let key2 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: validIterations)
        #expect(key1 == key2)
    }

    @Test func deriveClientKey_differentPins_differentKeys() async throws {
        let key1 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: validIterations)
        let key2 = try await sut.deriveClientKey(pin: "5678", saltHex: validSalt, iterations: validIterations)
        #expect(key1 != key2)
    }

    @Test func deriveClientKey_differentSalts_differentKeys() async throws {
        let salt2 = "bb" * 32
        let key1 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: validIterations)
        let key2 = try await sut.deriveClientKey(pin: "1234", saltHex: salt2, iterations: validIterations)
        #expect(key1 != key2)
    }

    @Test func deriveClientKey_differentIterations_differentKeys() async throws {
        // Use two valid iteration counts to verify different keys are produced
        let key1 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.minIterations)
        let key2 = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.minIterations + 1)
        #expect(key1 != key2)
    }

    @Test func deriveClientKey_oddLengthSalt_throwsInvalidSalt() async {
        await #expect(throws: CryptoServiceError.invalidSalt) {
            try await sut.deriveClientKey(pin: "1234", saltHex: "abc", iterations: validIterations)
        }
    }

    @Test func deriveClientKey_nonHexSalt_throwsInvalidSalt() async {
        let badSalt = "zz" * 32
        await #expect(throws: CryptoServiceError.invalidSalt) {
            try await sut.deriveClientKey(pin: "1234", saltHex: badSalt, iterations: validIterations)
        }
    }

    @Test func deriveClientKey_longPin_succeeds() async throws {
        let key = try await sut.deriveClientKey(pin: "12345678", saltHex: validSalt, iterations: validIterations)
        #expect(key.count == 64)
    }
    
    // MARK: - Iteration Bounds Validation
    
    @Test func deriveClientKey_iterationsBelowMinimum_throwsInvalidIterations() async {
        await #expect(throws: CryptoServiceError.invalidIterations) {
            try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.minIterations - 1)
        }
    }
    
    @Test func deriveClientKey_iterationsAtMinimum_succeeds() async throws {
        let key = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.minIterations)
        #expect(key.count == 64)
    }
    
    @Test func deriveClientKey_iterationsAboveMaximum_throwsInvalidIterations() async {
        await #expect(throws: CryptoServiceError.invalidIterations) {
            try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.maxIterations + 1)
        }
    }
    
    @Test(.timeLimit(.minutes(1))) func deriveClientKey_iterationsAtMaximum_succeeds() async throws {
        // Note: This test is slower due to high iteration count
        let key = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: CryptoService.maxIterations)
        #expect(key.count == 64)
    }
    
    @Test func deriveClientKey_zeroIterations_throwsInvalidIterations() async {
        await #expect(throws: CryptoServiceError.invalidIterations) {
            try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: 0)
        }
    }
    
    @Test func deriveClientKey_negativeIterations_throwsInvalidIterations() async {
        await #expect(throws: CryptoServiceError.invalidIterations) {
            try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: -1)
        }
    }
    
    @Test func deriveClientKey_typicalProductionIterations_succeeds() async throws {
        // 600k is the typical production value
        let productionIterations = 600_000
        let key = try await sut.deriveClientKey(pin: "1234", saltHex: validSalt, iterations: productionIterations)
        #expect(key.count == 64)
    }

    // MARK: - isValidClientKeyHex

    @Test func isValidClientKeyHex_valid64CharLowercaseHex_returnsTrue() async {
        let hex = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
        let result = await sut.isValidClientKeyHex(hex)
        #expect(result == true)
    }

    @Test func isValidClientKeyHex_validMixedCaseHex_returnsTrue() async {
        let hex = "AbCdEf0123456789abcdef0123456789ABCDEF0123456789abcdef0123456789"
        let result = await sut.isValidClientKeyHex(hex)
        #expect(result == true)
    }

    @Test func isValidClientKeyHex_tooShort_returnsFalse() async {
        let result = await sut.isValidClientKeyHex("abcdef")
        #expect(result == false)
    }

    @Test func isValidClientKeyHex_tooLong_returnsFalse() async {
        let hex = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567890"
        let result = await sut.isValidClientKeyHex(hex)
        #expect(result == false)
    }

    @Test func isValidClientKeyHex_empty_returnsFalse() async {
        let result = await sut.isValidClientKeyHex("")
        #expect(result == false)
    }

    @Test func isValidClientKeyHex_allZeros_returnsFalse() async {
        let hex = String(repeating: "0", count: 64)
        let result = await sut.isValidClientKeyHex(hex)
        #expect(result == false)
    }

    @Test func isValidClientKeyHex_nonHexChars_returnsFalse() async {
        let hex = "zzzzzz0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
        let result = await sut.isValidClientKeyHex(hex)
        #expect(result == false)
    }

    @Test func isValidClientKeyHex_demoClientKey_returnsTrue() async {
        let result = await sut.isValidClientKeyHex(Self.demoClientKey)
        #expect(result == true)
    }

    // MARK: - Performance (Manual Validation)

    /// Validates real-world PBKDF2 performance with production iteration count.
    /// Disabled by default - run manually to verify crypto performance on target devices.
    /// Expected: ~200-500ms on modern iOS devices with 600k iterations.
    @Test(.disabled("Manual performance validation - run locally when needed"))
    func deriveClientKey_productionIterations_completesInReasonableTime() async throws {
        let productionIterations = 600_000
        let start = ContinuousClock().now
        
        let key = try await sut.deriveClientKey(
            pin: "1234",
            saltHex: validSalt,
            iterations: productionIterations
        )
        
        let elapsed = ContinuousClock().now - start
        
        #expect(key.count == 64)
        #expect(elapsed < .seconds(2), "PBKDF2 with \(productionIterations) iterations took \(elapsed), expected < 2s")
    }
}

// MARK: - String repeat helper

private func * (lhs: String, rhs: Int) -> String {
    String(repeating: lhs, count: rhs)
}
