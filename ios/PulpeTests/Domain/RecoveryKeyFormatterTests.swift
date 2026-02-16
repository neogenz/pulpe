import Foundation
import Testing
@testable import Pulpe

struct RecoveryKeyFormatterTests {
    @Test func strip_mixedInput_returnsUppercaseBase32Only() {
        #expect(RecoveryKeyFormatter.strip("abcd-2345") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("  ABCD 2345  ") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("abcd!@#$2345") == "ABCD2345")
        #expect(RecoveryKeyFormatter.strip("0189") == "") // Strictly A-Z, 2-7
    }
    
    @Test func format_validInput_insertsHyphensEveryFourChars() {
        #expect(RecoveryKeyFormatter.format("ABCDEFGH2345") == "ABCD-EFGH-2345")
        #expect(RecoveryKeyFormatter.format("abcd234") == "ABCD-234")
        #expect(RecoveryKeyFormatter.format("a") == "A")
        #expect(RecoveryKeyFormatter.format("") == "")
    }
}
