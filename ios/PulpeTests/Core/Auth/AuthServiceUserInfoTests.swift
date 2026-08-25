import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("AuthService.userInfo(from:fallbackEmail:)")
struct AuthServiceUserInfoTests {
    // MARK: - Email resolution (PUL-128 regression guard)

    @Test func emailPresent_isUsedAndFallbackIgnored() {
        let user = makeUser(email: "real@example.com")

        let info = AuthService.userInfo(from: user, fallbackEmail: "ignored@example.com")

        #expect(info.email == "real@example.com")
    }

    @Test func emailNil_fallsBackToProvidedEmail() {
        let user = makeUser(email: nil)

        let info = AuthService.userInfo(from: user, fallbackEmail: "fallback@example.com")

        #expect(info.email == "fallback@example.com")
    }

    /// Guards the OAuth contract: `signInWithApple` / `signInWithGoogle` pass
    /// `fallbackEmail: ""`. If Supabase ever returns a nil `user.email` for an
    /// OAuth session, the resulting `UserInfo.email` is an empty string. This
    /// is the exact behavior we preserved when removing `extractEmailFromToken`.
    @Test func oAuthSessionWithNilEmail_producesEmptyEmailUserInfo() {
        let user = makeUser(email: nil)

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(info.email.isEmpty)
    }

    // MARK: - First name: firstName > given_name; never `name` or email

    @Test(
        "firstName resolution ignores provider name and email",
        arguments: [
            (["firstName": .string("Alice"), "given_name": .string("Bob"), "name": .string("Carol")], "Alice"),
            (["given_name": .string("Bob"), "name": .string("Carol")], "Bob"),
            (["name": .string("Carol")], nil),
            (["firstName": .string("  Marie  ")], "Marie"),
            (["firstName": .string("   "), "given_name": .string("Bob")], "Bob"),
            (["firstName": .string("")], nil),
            (["email": .string("xyz@privaterelay.appleid.com"), "name": .string("Carol")], nil),
        ] as [([String: AnyJSON], String?)]
    )
    func firstNameResolution(metadata: [String: AnyJSON], expected: String?) {
        let user = makeUser(email: "xyz@privaterelay.appleid.com", userMetadata: metadata)

        let info = AuthService.userInfo(from: user, fallbackEmail: "xyz@privaterelay.appleid.com")

        #expect(info.firstName == expected)
    }

    @Test func noNameMetadata_firstNameIsNil() {
        let user = makeUser(email: "x@y.com", userMetadata: [:])

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(info.firstName == nil)
    }

    @Test func fallbackEmail_isNeverUsedAsFirstName() {
        let user = makeUser(email: nil, userMetadata: [:])

        let info = AuthService.userInfo(from: user, fallbackEmail: "marie@icloud.com")

        #expect(info.firstName == nil)
        #expect(info.email == "marie@icloud.com")
    }

    // MARK: - Provider mapping (Supabase returns both "apple" and "apple.com")

    @Test(
        "provider mapping accepts bare and dotted variants",
        arguments: [
            ("email", AuthProvider.email),
            ("apple", AuthProvider.apple),
            ("apple.com", AuthProvider.apple),
            ("google", AuthProvider.google),
            ("google.com", AuthProvider.google),
        ]
    )
    func providerMapping(rawValue: String, expected: AuthProvider) {
        let user = makeUser(
            email: "x@y.com",
            appMetadata: ["provider": .string(rawValue)]
        )

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(info.provider == expected)
    }

    @Test func unknownProvider_isNil() {
        let user = makeUser(
            email: "x@y.com",
            appMetadata: ["provider": .string("facebook")]
        )

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(info.provider == nil)
    }

    // MARK: - Early adopter flag

    @Test func earlyAdopterFlag_trueInAppMetadata_isPropagated() {
        let user = makeUser(
            email: "x@y.com",
            appMetadata: [AnalyticsService.earlyAdopterProperty: .bool(true)]
        )

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(info.isEarlyAdopter)
    }

    @Test func earlyAdopterFlag_missing_defaultsToFalse() {
        let user = makeUser(email: "x@y.com", appMetadata: [:])

        let info = AuthService.userInfo(from: user, fallbackEmail: "")

        #expect(!info.isEarlyAdopter)
    }

    // MARK: - Helpers

    private func makeUser(
        email: String?,
        userMetadata: [String: AnyJSON] = [:],
        appMetadata: [String: AnyJSON] = [:]
    ) -> User {
        User(
            id: UUID(),
            appMetadata: appMetadata,
            userMetadata: userMetadata,
            aud: "authenticated",
            email: email,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate
        )
    }
}
