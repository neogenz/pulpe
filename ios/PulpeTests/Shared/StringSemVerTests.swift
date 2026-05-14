import Foundation
@testable import Pulpe
import Testing

@Suite("String.isSemVerBelow")
struct StringSemVerTests {
    @Test("1.0.0 is below 1.0.1")
    func patchBumpIsBelow() {
        #expect("1.0.0".isSemVerBelow("1.0.1"))
    }

    @Test("1.0.1 is not below 1.0.1")
    func equalIsNotBelow() {
        #expect(!"1.0.1".isSemVerBelow("1.0.1"))
    }

    @Test("1.0.10 is not below 1.0.2 (numeric, not lexicographic)")
    func numericCompareNotLexicographic() {
        #expect(!"1.0.10".isSemVerBelow("1.0.2"))
        #expect("1.0.2".isSemVerBelow("1.0.10"))
    }

    @Test("Major bump dominates")
    func majorBump() {
        #expect("1.9.9".isSemVerBelow("2.0.0"))
        #expect(!"2.0.0".isSemVerBelow("1.9.9"))
    }

    @Test("Minor bump dominates patch")
    func minorBump() {
        #expect("1.1.0".isSemVerBelow("1.2.0"))
        #expect(!"1.10.0".isSemVerBelow("1.2.0"))
    }
}
