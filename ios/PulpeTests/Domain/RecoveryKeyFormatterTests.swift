import Foundation
@testable import Pulpe
import Testing

struct RecoveryKeyFormatterTests {
    @Test func strip_mixedInput_returnsUppercaseBase32Only() {
        #expect(RecoveryKeyFormatter.strip("abcd-2345") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("  ABCD 2345  ") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("abcd!@#$2345") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("0189").isEmpty)
    }

    @Test func format_validInput_insertsHyphensEveryFourChars() {
        #expect(RecoveryKeyFormatter.format("ABCDEFGH2345") == "ABCD-EFGH-2345")
        #expect(RecoveryKeyFormatter.format("abcd234") == "ABCD-234")
        #expect(RecoveryKeyFormatter.format("a") == "A")
        #expect(RecoveryKeyFormatter.format("").isEmpty)
    }

    // MARK: - Round-trip tests

    @Test func format_ofStripped_isIdempotent() {
        // format(strip(input)) == format(input) for various dirty inputs
        let inputs = ["abcd-2345", "  ABCD 2345  ", "abcd!@#$2345", "ABCD-EFGH-2345"]
        for input in inputs {
            #expect(
                RecoveryKeyFormatter.format(RecoveryKeyFormatter.strip(input)) == RecoveryKeyFormatter.format(input),
                "Round-trip failed for input: \(input)"
            )
        }
    }

    @Test func strip_ofFormatted_returnsOriginalStripped() {
        // strip(format(stripped)) == stripped for valid base32 strings
        let validBase32Inputs = ["ABCD2345", "ABCDEFGH2345ABCD", "A", "ABCDEFGH"]
        for input in validBase32Inputs {
            #expect(
                RecoveryKeyFormatter.strip(RecoveryKeyFormatter.format(input)) == input,
                "Round-trip failed for base32 input: \(input)"
            )
        }
    }

    // MARK: - containsInvalidCharacters tests

    @Test func containsInvalidCharacters_validBase32_returnsFalse() {
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("ABCD2345"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("abcd2345"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("234567"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"))
    }

    @Test func containsInvalidCharacters_withValidSeparators_returnsFalse() {
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("ABCD-EFGH-2345"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("ABCD EFGH 2345"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("ABCD-EFGH 2345"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("A-B-C-D"))
    }

    @Test func containsInvalidCharacters_invalidDigits_returnsTrue() {
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD0123"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD1234"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD8901"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD9999"))
    }

    @Test func containsInvalidCharacters_specialCharacters_returnsTrue() {
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD!@#$"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD.EFGH"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD/EFGH"))
        #expect(RecoveryKeyFormatter.containsInvalidCharacters("ABCD\\EFGH"))
    }

    @Test func containsInvalidCharacters_onlyValidSeparators_returnsFalse() {
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("----"))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("    "))
        #expect(!RecoveryKeyFormatter.containsInvalidCharacters("- - - "))
    }
}
