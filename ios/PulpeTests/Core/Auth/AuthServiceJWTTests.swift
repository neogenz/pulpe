import Foundation
@testable import Pulpe
import Testing

struct AuthServiceJWTTests {
    // MARK: - Helpers

    /// Build a fake JWT (header.payload.signature) with the given claims dictionary.
    private func makeToken(claims: [String: Any]) -> String {
        let header = Data("{}".utf8).base64EncodedString()
        let payloadData = (try? JSONSerialization.data(withJSONObject: claims)) ?? Data()
        let payload = payloadData
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "\(header).\(payload).fakesig"
    }

    // MARK: - extractEmailFromToken

    @Test func extractEmail_validToken_returnsEmail() {
        let token = makeToken(claims: ["email": "max@pulpe.app", "sub": "abc"])
        let email = AuthService.extractEmailFromToken(token)
        #expect(email == "max@pulpe.app")
    }

    @Test func extractEmail_noEmailClaim_returnsNil() {
        let token = makeToken(claims: ["sub": "abc", "name": "Max"])
        #expect(AuthService.extractEmailFromToken(token) == nil)
    }

    @Test func extractEmail_emptyString_returnsNil() {
        #expect(AuthService.extractEmailFromToken("") == nil)
    }

    @Test func extractEmail_malformedToken_twoSegments_returnsNil() {
        #expect(AuthService.extractEmailFromToken("header.payload") == nil)
    }

    @Test func extractEmail_invalidBase64Payload_returnsNil() {
        #expect(AuthService.extractEmailFromToken("a.!!!invalid!!!.c") == nil)
    }

    @Test func extractEmail_emailIsNotString_returnsNil() {
        let token = makeToken(claims: ["email": 42])
        #expect(AuthService.extractEmailFromToken(token) == nil)
    }
}
