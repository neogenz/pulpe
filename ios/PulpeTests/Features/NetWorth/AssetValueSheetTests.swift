import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AssetValueSheetTests {
    @Test func ownOverdraft_isNegative() {
        #expect(AssetValueSheet.snapshotValue(amount: 300, isNegative: true, direction: .own) == -300)
    }

    @Test func ownWithoutOverdraft_keepsTheAmount() {
        #expect(AssetValueSheet.snapshotValue(amount: 12500, isNegative: false, direction: .own) == 12500)
    }

    @Test func debt_neverGoesNegative() {
        #expect(AssetValueSheet.snapshotValue(amount: 8000, isNegative: true, direction: .owe) == 8000)
    }
}
