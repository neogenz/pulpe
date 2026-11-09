@testable import Pulpe
import Testing

@MainActor
struct AddBudgetLineAssetOriginTests {
    @Test("A cold store offers no asset origin until the sheet has loaded it")
    func assetOrigin_appearsOnceLoaded() async {
        let store = AssetStore(service: MockAssetService())
        #expect(!AddBudgetLineSheet.offersAsset(flagOn: true, store: store))

        await AddBudgetLineSheet.loadAssets(flagOn: true, store: store)

        #expect(AddBudgetLineSheet.offersAsset(flagOn: true, store: store))
        #expect(!AddBudgetLineSheet.offersAsset(flagOn: false, store: store))
    }

    @Test("The savings origin toggle offers the asset segment only when asked")
    func toggle_offersAssetOnlyWhenAsked() {
        #expect(!SavingsOrigin.options(offersAsset: false).contains(.asset))
        #expect(SavingsOrigin.options(offersAsset: true).contains(.asset))
    }

    @Test("Flag off never requests the assets")
    func flagOff_neverLoads() async {
        let service = MockAssetService()
        await AddBudgetLineSheet.loadAssets(flagOn: false, store: AssetStore(service: service))

        #expect(service.getNetWorthCallCount == 0)
    }
}

/// The origin of an income is one choice among three (PUL-329 v2). Before, a goal
/// picker and a "je remets le mois prochain" toggle could be armed together and
/// meant two contradictory things — these lock that this can no longer be said.
struct AddBudgetLineIncomeOriginTests {
    private struct Combination {
        let kind: TransactionKind
        let origin: IncomeOrigin
    }

    private static let combinations: [Combination] = TransactionKind.allCases.flatMap { kind in
        IncomeOrigin.allCases.map { Combination(kind: kind, origin: $0) }
    }

    @Test("No combination puts the sheet in both withdrawal modes at once")
    func origins_areMutuallyExclusive() {
        let overlapping = Self.combinations.filter {
            AddBudgetLineSheet.isSavingsWithdrawal(kind: $0.kind, origin: $0.origin)
                && AddBudgetLineSheet.isPlannedWithdrawal(kind: $0.kind, origin: $0.origin)
        }

        #expect(overlapping.isEmpty)
    }

    @Test("Each withdrawal mode answers to exactly one origin, and only on an income")
    func origins_mapToTheirOwnMode() {
        let planned = Self.combinations.filter {
            AddBudgetLineSheet.isPlannedWithdrawal(kind: $0.kind, origin: $0.origin)
        }
        let advance = Self.combinations.filter {
            AddBudgetLineSheet.isSavingsWithdrawal(kind: $0.kind, origin: $0.origin)
        }

        #expect(planned.map(\.origin) == [.savingsGoal])
        #expect(planned.map(\.kind) == [.income])
        #expect(advance.map(\.origin) == [.repayNextMonth])
        #expect(advance.map(\.kind) == [.income])
    }

    // The sheet asks "from my savings?" then "which?" — two controls over one origin.
    @Test("The savings toggle off is an ordinary income, whatever the segment")
    func toggleOff_isRegular() {
        for savings in SavingsOrigin.allCases {
            #expect(IncomeOrigin(isFromSavings: false, savingsOrigin: savings) == .regular)
        }
        #expect(!IncomeOrigin.regular.isFromSavings)
    }

    @Test("Each segment maps to its own origin and back")
    func segment_roundTrips() {
        #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: .goal) == .savingsGoal)
        #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: .repay) == .repayNextMonth)
        for origin in IncomeOrigin.allCases where origin.isFromSavings {
            #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: origin.savingsOrigin) == origin)
        }
    }

    @Test("Turning the toggle on starts on « D'un objectif »")
    func toggleOn_defaultsToGoal() {
        let turnedOn = IncomeOrigin(isFromSavings: true, savingsOrigin: IncomeOrigin.regular.savingsOrigin)
        #expect(turnedOn == .savingsGoal)
    }

    @Test("The asset origin maps both ways")
    func assetOrigin_roundTrips() {
        #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: .asset) == .asset)
        #expect(IncomeOrigin.asset.savingsOrigin == .asset)
    }

    @Test("An income carries an asset only in the asset origin, never next to a goal link")
    func linkedAssetId_incomeOnlyInAssetOrigin() {
        for origin in IncomeOrigin.allCases {
            let link = AddBudgetLineSheet.linkedAssetId(kind: .income, origin: origin, assetId: "a1")
            #expect(link == (origin == .asset ? "a1" : nil))
        }
        #expect(AddBudgetLineSheet.linkedAssetId(kind: .saving, origin: .regular, assetId: "a1") == "a1")
        #expect(!AddBudgetLineSheet.isPlannedWithdrawal(kind: .income, origin: .asset))
    }
}
