import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("FirstNameResolver")
struct FirstNameResolverTests {
    @Test(arguments: [
        ("Marie", "Marie"),
        ("  Marie  ", "Marie"),
        ("\nMax\t", "Max"),
    ])
    func normalized_trimsNonEmpty(raw: String, expected: String) {
        #expect(FirstNameResolver.normalized(raw) == expected)
    }

    @Test(arguments: [Optional<String>.none, Optional(""), Optional("   "), Optional("\n\t")])
    func normalized_blankIsNil(raw: String?) {
        #expect(FirstNameResolver.normalized(raw) == nil)
    }

    @Test func nameForPersistence_trims() throws {
        #expect(try FirstNameResolver.nameForPersistence("  Marie  ") == "Marie")
    }

    @Test(arguments: ["", "   "])
    func nameForPersistence_blankThrows(raw: String) {
        #expect(throws: AuthServiceError.emptyFirstName) {
            try FirstNameResolver.nameForPersistence(raw)
        }
    }

    @Test func canonical_prefersFirstNameOverGivenNameAndName() {
        let metadata: [String: AnyJSON] = [
            "firstName": .string("Alice"),
            "given_name": .string("Bob"),
            "name": .string("Carol"),
        ]
        #expect(FirstNameResolver.canonical(from: metadata) == "Alice")
    }

    @Test func canonical_usesGivenNameWhenFirstNameMissing() {
        let metadata: [String: AnyJSON] = [
            "given_name": .string("Bob"),
            "name": .string("Carol"),
        ]
        #expect(FirstNameResolver.canonical(from: metadata) == "Bob")
    }

    @Test func canonical_ignoresProviderNameAndEmail() {
        let metadata: [String: AnyJSON] = [
            "name": .string("Carol"),
            "email": .string("xyz@privaterelay.appleid.com"),
            "full_name": .string("Carol Dupont"),
        ]
        #expect(FirstNameResolver.canonical(from: metadata) == nil)
    }

    @Test func canonical_blankFirstNameFallsThroughToGivenName() {
        let metadata: [String: AnyJSON] = [
            "firstName": .string("  "),
            "given_name": .string("Bob"),
        ]
        #expect(FirstNameResolver.canonical(from: metadata) == "Bob")
    }

    @Test func applyingProviderGivenName_fillsWhenMetadataEmpty() {
        let user = UserInfo(id: "1", email: "a@b.com", firstName: nil)
        let patched = FirstNameResolver.applyingProviderGivenName("Marie", to: user)
        #expect(patched.firstName == "Marie")
    }

    @Test func applyingProviderGivenName_doesNotOverwriteExistingFirstName() {
        let user = UserInfo(id: "1", email: "a@b.com", firstName: "Alice")
        let patched = FirstNameResolver.applyingProviderGivenName("Bob", to: user)
        #expect(patched.firstName == "Alice")
    }

    @Test func applyingProviderGivenName_ignoresBlankGivenName() {
        let user = UserInfo(id: "1", email: "a@b.com", firstName: nil)
        let patched = FirstNameResolver.applyingProviderGivenName("  ", to: user)
        #expect(patched.firstName == nil)
    }

    @Test func coalescing_usesFallbackWhenAPIOmitsFirstName() {
        let persisted = UserInfo(id: "1", email: "a@b.com", firstName: nil)
        let merged = FirstNameResolver.coalescing(persisted, fallbackFirstName: "Marie")
        #expect(merged.firstName == "Marie")
    }

    @Test func coalescing_prefersAPIFirstNameOverFallback() {
        let persisted = UserInfo(id: "1", email: "a@b.com", firstName: "Léa")
        let merged = FirstNameResolver.coalescing(persisted, fallbackFirstName: "Marie")
        #expect(merged.firstName == "Léa")
    }

    @Test func coalescing_whitespaceAPIUsesFallback() {
        let persisted = UserInfo(id: "1", email: "a@b.com", firstName: "  ")
        let merged = FirstNameResolver.coalescing(persisted, fallbackFirstName: "Marie")
        #expect(merged.firstName == "Marie")
    }
}
