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
            archivedAt: nil, latestValue: 3000, recordedValue: 3000, latestRecordedAt: TestDataFactory.fixedDate,
            convertedValue: nil
        )
        let sections = NetWorthSections(netWorth([usd], incomplete: true))

        #expect(usd.badges == [.excluded])
        #expect(!usd.showsConversion(in: .chf))
        #expect(sections.unconverted.map(\.name) == ["Livret"])
        #expect(sections.incomplete)
    }

    @Test func convertedForeignAsset_showsConversion() {
        let eur = Asset(
            id: "f", categoryId: "c2", name: "Livret", currency: .eur, direction: .own, inPulpe: false,
            archivedAt: nil, latestValue: 3000, recordedValue: 3000, latestRecordedAt: TestDataFactory.fixedDate,
            convertedValue: 2820
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

    // MARK: - Since the last entry (PUL-377)

    /// Livret entered at 10 000 on 3 November, then an Épargne of 500 checked; read on 24 November.
    private let entryDate = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 3, hour: 12)) ?? .now
    private var now: Date { entryDate.addingTimeInterval(21 * 86400) }
    private func livret(
        latestValue: Decimal = 10500,
        recordedValue: Decimal = 10000,
        recordedAt: Date? = nil,
        inPulpe: Bool = false
    ) -> Asset {
        TestDataFactory.makeAsset(
            name: "Livret", inPulpe: inPulpe, latestValue: latestValue, recordedValue: recordedValue,
            latestRecordedAt: recordedAt ?? entryDate
        )
    }

    @Test func metaLine_saysWhatMovedSinceTheEntry_withItsDate() {
        #expect(livret().movedSinceEntry == 500)
        #expect(livret().metaLine(categoryName: nil, now: now, language: .fr)
            == "+500.00 CHF depuis ta saisie du 3 novembre")
        #expect(livret().metaLine(categoryName: "Épargne", now: now, language: .fr)
            == "Épargne · +500.00 CHF depuis ta saisie du 3 novembre")
        #expect(livret(inPulpe: true).metaLine(categoryName: nil, now: now, language: .fr)
            == "+500.00 CHF depuis ta saisie du 3 novembre · à la comparaison")
    }

    @Test func metaLine_signsADropWithTheWebMinus() {
        let drawn = livret(latestValue: 9700)
        #expect(drawn.movedSinceEntry == -300)
        #expect(drawn.metaLine(categoryName: nil, now: now, language: .fr)
            == "\u{2212}300.00 CHF depuis ta saisie du 3 novembre")
    }

    @Test func entryOfAnEarlierYear_carriesTheYear() {
        let lastYear = Calendar.current.date(byAdding: .year, value: -1, to: entryDate) ?? entryDate
        let old = livret(recordedAt: lastYear)
        #expect(old.metaLine(categoryName: nil, now: now, language: .fr)
            == "+500.00 CHF depuis ta saisie du 3 novembre 2025")
        #expect(old.lastEntryCaption(now: now, language: .fr)
            == "Ta dernière saisie : 10\u{2019}000.00 CHF, le 3 novembre 2025")
    }

    @Test func metaLine_nothingMoved_keepsTheAge() {
        let unchanged = livret(latestValue: 10000)
        let now = entryDate.addingTimeInterval(3600)
        #expect(unchanged.movedSinceEntry == nil)
        #expect(unchanged.metaLine(categoryName: nil, now: now, language: .fr) == "Mis à jour aujourd'hui")
    }

    @Test func lastEntryCaption_recallsTheEntry_notTheUpToDateValue() {
        #expect(livret().lastEntryCaption(now: now, language: .fr)
            == "Ta dernière saisie : 10\u{2019}000.00 CHF, le 3 novembre")
    }

    /// The « Découvert » box follows the up-to-date value, so the entry carries its own sign.
    @Test func lastEntryCaption_signsTheEntry_notTheValue() {
        let overdrawn = livret(latestValue: -600, recordedValue: 400)
        #expect(overdrawn.lastEntryCaption(now: now, language: .fr) == "Ta dernière saisie : 400.00 CHF, le 3 novembre")

        let refilled = livret(latestValue: 300, recordedValue: -200)
        #expect(refilled.lastEntryCaption(now: now, language: .fr)
            == "Ta dernière saisie : \u{2212}200.00 CHF, le 3 novembre")
    }

    @Test func togglingACardFoldsItThenUnfoldsIt_leavingTheOthers() {
        let folded = NetWorthSections.toggled("loans", in: "cash")
        #expect(NetWorthSections.isCollapsed("loans", in: folded))
        #expect(NetWorthSections.isCollapsed("cash", in: folded))

        let unfolded = NetWorthSections.toggled("loans", in: folded)
        #expect(!NetWorthSections.isCollapsed("loans", in: unfolded))
        #expect(unfolded == "cash")
        #expect(!NetWorthSections.isCollapsed("cash", in: ""))
    }
}
