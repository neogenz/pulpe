import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AppleSignInCoordinatorTests {
    // MARK: - randomNonceString

    @Test func randomNonceString_generatesCorrectLength() {
        let nonce = AppleSignInCoordinator.randomNonceString(length: 64)
        #expect(nonce.count == 64)
    }

    @Test func randomNonceString_onlyContainsCharsetCharacters() {
        let charset = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_")
        let nonce = AppleSignInCoordinator.randomNonceString(length: 128)
        for char in nonce {
            #expect(charset.contains(char), "Unexpected character: \(char)")
        }
    }

    @Test func randomNonceString_generatesDifferentValues() {
        let nonce1 = AppleSignInCoordinator.randomNonceString()
        let nonce2 = AppleSignInCoordinator.randomNonceString()
        #expect(nonce1 != nonce2)
    }

    // MARK: - sha256

    @Test func sha256_producesCorrectHashForKnownInput() {
        // SHA-256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
        let hash = AppleSignInCoordinator.sha256("test")
        #expect(hash == "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    }
}
