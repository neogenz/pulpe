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
}
