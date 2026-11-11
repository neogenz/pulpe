import Foundation
@testable import Pulpe
import Testing

@MainActor
struct NetWorthSectionsTests {
    private func netWorth(
        _ assets: [Asset],
        categories: [AssetCategory] = [
            AssetCategory(id: "c1", name: "Comptes", total: 12000),
            AssetCategory(id: "c2", name: "Épargne", total: 2820),
            AssetCategory(id: "c3", name: "Vide", total: 0),
        ],
        incomplete: Bool = false
    ) -> NetWorth {
        NetWorth(
            totals: NetWorthTotals(baseCurrency: .chf, gross: 14820, debts: 8000, net: 6820, incomplete: incomplete),
            categories: categories,
            assets: assets
        )
    }

    @Test func groupsActiveOwnAssetsByCategoryInApiOrder_withApiTotals() {
        let sections = NetWorthSections(netWorth([
            TestDataFactory.makeAsset(id: "a2", categoryId: "c2", name: "Livret"),
            TestDataFactory.makeAsset(id: "a1", categoryId: "c1", name: "UBS"),
        ]))

        #expect(sections.categories.map(\.name) == ["Comptes", "Épargne"])
        #expect(sections.categories.map(\.total) == [12000, 2820])
        #expect(sections.debtsTotal == 8000)
    }

    @Test func emptyCategoryIsHidden() {
        let sections = NetWorthSections(netWorth([TestDataFactory.makeAsset(categoryId: "c1")]))

        #expect(!sections.categories.contains { $0.id == "c3" })
    }

    @Test func oweAndOverdrawnOwnGoToDebts_notTheirCategory() {
        let sections = NetWorthSections(netWorth([
            TestDataFactory.makeAsset(id: "lease", categoryId: "c1", direction: .owe, latestValue: 8000),
            TestDataFactory.makeAsset(id: "over", categoryId: "c1", latestValue: -300),
            TestDataFactory.makeAsset(id: "ok", categoryId: "c1", latestValue: 10),
        ]))

        #expect(sections.debts.map(\.id) == ["lease", "over"])
        #expect(sections.categories.first?.assets.map(\.id) == ["ok"])
        #expect(sections.debts.last?.badges.contains(.overdraft) == true)
    }

    @Test func debtsAreGroupedByType_thenTheOverdrafts() {
        let sections = NetWorthSections(netWorth([
            TestDataFactory.makeAsset(id: "over", categoryId: "c1", latestValue: -300),
            TestDataFactory.makeAsset(id: "lease", categoryId: "c2", direction: .owe, latestValue: 8000),
            TestDataFactory.makeAsset(id: "card", categoryId: "c2", direction: .owe, latestValue: 200),
            TestDataFactory.makeAsset(id: "loan", categoryId: "c1", direction: .owe, latestValue: 500),
        ]))

        #expect(sections.debtGroups.map(\.id) == ["c1", "c2", NetWorthSections.overdraftsId])
        #expect(sections.debtGroups.map(\.total) == [500, 8200, 300])
        #expect(sections.debtGroups.map(\.isType) == [true, true, false])
        #expect(sections.debtGroups.last?.assets.map(\.id) == ["over"])
    }

    @Test func archivedAssetsAreListedApart_outsideCategoriesAndDebts() {
        let sections = NetWorthSections(netWorth([
            TestDataFactory.makeAsset(id: "old", archivedAt: TestDataFactory.fixedDate),
            TestDataFactory.makeAsset(id: "old-debt", direction: .owe, archivedAt: TestDataFactory.fixedDate),
        ]))

        #expect(sections.archived.map(\.id) == ["old", "old-debt"])
        #expect(sections.categories.isEmpty)
        #expect(sections.debts.isEmpty)
        #expect(!sections.isEmpty)
    }

    @Test func noAsset_isEmpty() {
        #expect(NetWorthSections(netWorth([])).isEmpty)
    }

    @Test func unconvertedForeignAsset_isExcluded_andShowsNoConversion() {
        let usd = Asset(
            id: "f", categoryId: "c1", name: "Livret", currency: .eur, direction: .own, inPulpe: true,
            archivedAt: nil, latestValue: 3000, latestRecordedAt: TestDataFactory.fixedDate,
            convertedValue: nil, suggestion: nil
        )
        let sections = NetWorthSections(netWorth([usd], incomplete: true))

        #expect(usd.badges == [.inPulpe, .excluded])
        #expect(!usd.showsConversion(in: .chf))
        #expect(sections.unconverted.map(\.name) == ["Livret"])
        #expect(sections.incomplete)
    }

    @Test func convertedForeignAsset_showsConversion() {
        let eur = Asset(
            id: "f", categoryId: "c2", name: "Livret", currency: .eur, direction: .own, inPulpe: false,
            archivedAt: nil, latestValue: 3000, latestRecordedAt: TestDataFactory.fixedDate,
            convertedValue: 2820, suggestion: nil
        )

        #expect(eur.showsConversion(in: .chf))
        #expect(!TestDataFactory.makeAsset().showsConversion(in: .chf))
        #expect(NetWorthSections(netWorth([eur])).hasForeignValues)
    }

    @Test func ageLabel_todayThenRelative() {
        let now = TestDataFactory.fixedDate
        let locale = Locale(identifier: "fr")
        let calendar = Calendar(identifier: .gregorian)
        let today = TestDataFactory.makeAsset()
        #expect(today.ageLabel(now: now, calendar: calendar, locale: locale) == "aujourd'hui")

        let later = now.addingTimeInterval(3 * 86400)
        #expect(today.ageLabel(now: later, calendar: calendar, locale: locale) == "il y a 3 jours")
    }

    // MARK: - Suggestion

    @Test func archivedAssetHidesItsSuggestion() {
        let suggestion = AssetSuggestion(delta: 500, proposedValue: 3500)
        let active = TestDataFactory.makeAsset(suggestion: suggestion)
        let archived = TestDataFactory.makeAsset(archivedAt: TestDataFactory.fixedDate, suggestion: suggestion)

        #expect(active.visibleSuggestion == suggestion)
        #expect(archived.visibleSuggestion == nil)
    }

    @Test func suggestionDetail_followsDirectionAndSign() {
        let saved = TestDataFactory.makeAsset(suggestion: AssetSuggestion(delta: 500, proposedValue: 3500))
        let drawn = TestDataFactory.makeAsset(suggestion: AssetSuggestion(delta: -200, proposedValue: 800))
        let repaid = TestDataFactory.makeAsset(
            direction: .owe, suggestion: AssetSuggestion(delta: -400, proposedValue: 7600)
        )

        #expect(saved.suggestionDetail == .saved)
        #expect(drawn.suggestionDetail == .drawn)
        #expect(repaid.suggestionDetail == .repaid)
    }

    @Test func suggestionMagnitudeIsUnsigned() {
        let drawn = TestDataFactory.makeAsset(suggestion: AssetSuggestion(delta: -200, proposedValue: 800))

        #expect(drawn.suggestionMagnitude == 200)
    }
}
