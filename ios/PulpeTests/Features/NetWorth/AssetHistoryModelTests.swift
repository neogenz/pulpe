import Foundation
@testable import Pulpe
import Testing

/// The contract data set (PUL-379) as Swift values: « Compte courant » worth 9 420 after its
/// 5 000 entry of 1 November, « Livret » with a single 10 000 entry.
private enum HistoryFixture {
    static func day(_ iso: String) -> Date {
        ISO8601DateFormatter().date(from: "\(iso)T10:00:00Z") ?? .distantPast
    }

    static let compteCourant = TestDataFactory.makeAsset(
        id: "cc", name: "Compte courant", latestValue: 9420, recordedValue: 5000, latestRecordedAt: day("2026-11-01")
    )
    static let livret = TestDataFactory.makeAsset(
        id: "livret", name: "Livret", latestValue: 10000, latestRecordedAt: day("2026-11-01")
    )

    static func movement(_ id: String, _ name: String, _ at: String, _ effect: Decimal?, supersededAt: String? = nil)
        -> AssetHistoryEntry {
        AssetHistoryEntry(
            sourceId: id, at: day(at),
            kind: .movement(name: name, effect: effect, supersededAt: supersededAt.map(day))
        )
    }

    static func snapshot(_ id: String, _ at: String, _ value: Decimal) -> AssetHistoryEntry {
        AssetHistoryEntry(sourceId: id, at: day(at), kind: .snapshot(value: value))
    }

    static let firstPage = AssetHistory(
        asset: compteCourant,
        entries: [
            movement("salaire", "Salaire", "2026-11-10", 6000),
            movement("restaurant", "Restaurant", "2026-11-05", -80),
            movement("loyer", "Loyer", "2026-11-03", -1500),
        ],
        nextCursor: "page-2"
    )

    static let secondPage = AssetHistory(
        asset: compteCourant,
        entries: [
            snapshot("s2", "2026-11-01", 5000),
            movement("assurance", "Assurance", "2026-10-28", -300, supersededAt: "2026-11-01"),
            snapshot("s1", "2026-10-01", 4800),
        ],
        nextCursor: nil
    )
}

@MainActor
@Suite("AssetHistoryModel")
struct AssetHistoryModelTests {
    private func makeModel(_ service: MockAssetService) -> AssetHistoryModel {
        AssetHistoryModel(assetId: "cc", service: service)
    }

    private func pagedService() -> MockAssetService {
        let service = MockAssetService()
        service.stubbedHistory = [nil: HistoryFixture.firstPage, "page-2": HistoryFixture.secondPage]
        return service
    }

    @Test
    func load_thenLoadMore_appendsUntilNoCursor() async {
        let service = pagedService()
        let model = makeModel(service)

        await model.load()
        #expect(model.asset == HistoryFixture.compteCourant)
        #expect(model.entries.count == 3)
        #expect(model.nextCursor == "page-2")

        await model.loadMore()
        #expect(model.entries.map(\.sourceId) == ["salaire", "restaurant", "loyer", "s2", "assurance", "s1"])
        #expect(model.nextCursor == nil)

        await model.loadMore()
        #expect(service.historyCursors == [nil, "page-2"])
    }

    /// A full first page of 30 movements, then `count` older ones on the next page.
    private func longService(firstName: String = "Courses", count: Int = 5) -> MockAssetService {
        let day = { (index: Int) in String(format: "2026-11-%02d", 30 - index % 28) }
        let first = (0..<30).map { HistoryFixture.movement("m\($0)", firstName, day($0), -10) }
        let older = (30..<(30 + count)).map { HistoryFixture.movement("m\($0)", "Courses", "2026-10-01", -10) }
        let service = MockAssetService()
        service.stubbedHistory = [
            nil: AssetHistory(asset: HistoryFixture.compteCourant, entries: first, nextCursor: "page-2"),
            "page-2": AssetHistory(asset: HistoryFixture.compteCourant, entries: older, nextCursor: nil),
        ]
        return service
    }

    @Test
    func reload_withTheSameFirstPage_keepsWhatWasAppended() async {
        let service = longService()
        let model = makeModel(service)
        await model.load()
        await model.loadMore()

        await model.load()

        #expect(model.entries.count == 35)
        #expect(model.nextCursor == nil)
        #expect(service.historyCursors == [nil, "page-2", nil, "page-2"])
    }

    /// A movement unchecked below the first page leaves it unchanged: its line still goes away.
    @Test
    func reload_withTheSameFirstPage_rereadsTheOlderPages() async throws {
        let service = longService()
        let model = makeModel(service)
        await model.load()
        await model.loadMore()
        let older = try #require(service.stubbedHistory["page-2"])
        service.stubbedHistory["page-2"] = AssetHistory(
            asset: older.asset, entries: Array(older.entries.dropLast()), nextCursor: nil
        )

        await model.load()

        #expect(model.entries.count == 34)
        #expect(model.nextCursor == nil)
    }

    /// PUL-380: a prévision edited without being checked moves the projection, not the history.
    @Test
    func reload_withTheSameFirstPage_takesTheFreshProjection() async throws {
        let service = longService()
        service.stubbedHistory[nil]?.monthEndProjection = AssetMonthEndProjection(month: 11, year: 2026, value: 8000)
        let model = makeModel(service)
        await model.load()
        await model.loadMore()
        #expect(model.monthEndProjection?.value == 8000)
        service.stubbedHistory[nil]?.monthEndProjection = AssetMonthEndProjection(month: 11, year: 2026, value: 7900)

        await model.load()

        #expect(model.entries.count == 35)
        #expect(model.monthEndProjection?.value == 7900)

        service.stubbedHistory[nil]?.monthEndProjection = nil
        await model.load()
        #expect(model.monthEndProjection == nil)
    }

    /// PUL-380 CA8: the projection sits beside the value, it never replaces it.
    @Test
    func load_withAProjection_keepsTheAssetValue() async {
        let service = pagedService()
        service.stubbedHistory[nil]?.monthEndProjection = AssetMonthEndProjection(month: 11, year: 2026, value: 8000)
        let model = makeModel(service)

        await model.load()

        #expect(model.monthEndProjection?.value == 8000)
        #expect(model.asset?.latestValue == 9420)
    }

    @Test
    func reload_withAChangedFirstPage_replacesTheList() async {
        let service = longService()
        let model = makeModel(service)
        await model.load()
        await model.loadMore()
        service.stubbedHistory[nil] = longService(firstName: "Courses Migros").stubbedHistory[nil]

        await model.load()

        #expect(model.entries.count == 30)
        #expect(model.entries.first?.kind == .movement(name: "Courses Migros", effect: -10, supersededAt: nil))
        #expect(model.nextCursor == "page-2")
    }

    @Test
    func loadMore_whileOneIsInFlight_isIgnored() async {
        let service = pagedService()
        let model = makeModel(service)
        await model.load()
        service.holdGetHistory = true

        let first = Task { await model.loadMore() }
        await waitForCondition { service.didEnterHold }
        await model.loadMore()
        service.release()
        await first.value

        #expect(service.historyCursors == [nil, "page-2"])
        #expect(model.entries.count == 6)
    }

    @Test
    func loadMore_fromAnOlderLoad_isDropped() async {
        let service = pagedService()
        let model = makeModel(service)
        await model.load()
        service.holdGetHistory = true

        let stale = Task { await model.loadMore() }
        await waitForCondition { service.didEnterHold }
        service.holdGetHistory = false
        await model.load()
        service.release()
        await stale.value

        #expect(model.entries.count == 3)
        #expect(model.nextCursor == "page-2")
        #expect(!model.isLoadingMore)
    }

    @Test
    func loadMore_failure_keepsTheEntriesAndFlagsIt() async {
        let service = pagedService()
        let model = makeModel(service)
        await model.load()
        service.getHistoryError = APIError.networkError(URLError(.notConnectedToInternet))

        await model.loadMore()

        #expect(model.loadMoreFailed)
        #expect(model.entries.count == 3)
        #expect(model.nextCursor == "page-2")
    }

    @Test
    func load_unknownAsset_isNotFound() async {
        let model = makeModel(MockAssetService())

        await model.load()

        guard case .notFound = model.content else {
            Issue.record("Expected notFound, got \(model.content)")
            return
        }
    }

    /// CA19: « Courses » checked in two periods comes twice with the same id; the list keeps both.
    @Test
    func ca19_samePrevisionTwice_rendersBothRows() async {
        let service = MockAssetService()
        service.stubbedHistory = [nil: AssetHistory(
            asset: HistoryFixture.compteCourant,
            entries: [
                HistoryFixture.movement("courses", "Courses", "2026-11-04", -280),
                HistoryFixture.snapshot("s2", "2026-11-01", 5000),
                HistoryFixture.movement("courses", "Courses", "2026-10-28", -120, supersededAt: "2026-11-01"),
            ],
            nextCursor: nil
        )]
        let model = makeModel(service)

        await model.load()

        let courses = model.entries.filter { $0.sourceId == "courses" }
        #expect(courses.count == 2)
        #expect(Set(model.entries.map(\.id)).count == model.entries.count)
    }

    @Test
    func nothingCheckedSince_isTheEntryDate_onlyWhenTheNewestLineIsAnEntry() async {
        let livret = MockAssetService()
        livret.stubbedHistory = [nil: AssetHistory(
            asset: HistoryFixture.livret,
            entries: [HistoryFixture.snapshot("l1", "2026-11-01", 10000)],
            nextCursor: nil
        )]
        let livretModel = AssetHistoryModel(assetId: "livret", service: livret)
        let compteModel = makeModel(pagedService())

        await livretModel.load()
        await compteModel.load()

        #expect(livretModel.nothingCheckedSince == HistoryFixture.day("2026-11-01"))
        #expect(compteModel.nothingCheckedSince == nil)
    }
}

@Suite("AssetHistoryLine")
struct AssetHistoryLineTests {
    private let now = HistoryFixture.day("2026-11-24")

    private func line(
        _ entry: AssetHistoryEntry,
        currency: SupportedCurrency = .chf,
        language: SupportedLocale = .fr
    ) -> AssetHistoryLine {
        AssetHistoryLine(entry, currency: currency, now: now, language: language)
    }

    private func day(_ iso: String, _ language: SupportedLocale = .fr) -> String {
        Formatters.dayMonthLabel(for: HistoryFixture.day(iso), in: language)
    }

    @Test
    func movement_readsNameDateAndSignedEffect() {
        let salaire = line(HistoryFixture.movement("s", "Salaire", "2026-11-10", 6000))
        let loyer = line(HistoryFixture.movement("l", "Loyer", "2026-11-03", -1500))

        #expect(salaire.accessibilityLabel(amountsHidden: false)
            == "Salaire, \(day("2026-11-10")), +\(Decimal(6000).asCurrency(.chf))")
        #expect(loyer.amount == "\u{2212}\(Decimal(1500).asCurrency(.chf))")
        #expect(!loyer.isSuperseded)
    }

    @Test
    func snapshot_readsRecordedValue() {
        let entry = line(HistoryFixture.snapshot("s2", "2026-11-01", 5000))

        #expect(entry.accessibilityLabel(amountsHidden: false)
            == "Valeur enregistrée, 1er novembre, \(Decimal(5000).asCurrency(.chf))")
    }

    @Test
    func supersededMovement_carriesTheLegend() {
        let assurance = line(
            HistoryFixture.movement("a", "Assurance", "2026-10-28", -300, supersededAt: "2026-11-01")
        )

        #expect(assurance.isSuperseded)
        #expect(assurance.legend == "Déjà compris dans ta saisie du 1er novembre")
        #expect(assurance.accessibilityLabel(amountsHidden: true)
            == "Assurance, \(day("2026-10-28")), Déjà compris dans ta saisie du 1er novembre")
    }

    @Test
    func movementWithoutRate_hasNoAmount() {
        let courses = line(HistoryFixture.movement("c", "Courses", "2026-11-04", nil))

        #expect(courses.amount == nil)
        #expect(courses.accessibilityLabel(amountsHidden: false) == "Courses, \(day("2026-11-04"))")
    }

    @Test
    func english_translatesTheFixedWords() {
        let assurance = line(
            HistoryFixture.movement("a", "Assurance", "2026-10-28", -300, supersededAt: "2026-11-01"),
            language: .en
        )

        #expect(assurance.date == day("2026-10-28", .en))
        #expect(assurance.legend == "Already included in your entry on \(day("2026-11-01", .en))")
    }

    /// The server's debt example (asset.formulas.spec, CA13): on a debt of 200, a repayment of 300
    /// moves it by −200 and a purchase checked afterwards by +100; once at zero, a repayment by 0.
    @Test
    func ca13_debtEffects_keepTheServerSigns() {
        let achat = line(HistoryFixture.movement("achat", "Achat", "2026-11-04", 100))
        let remboursement = line(HistoryFixture.movement("remboursement", "Remboursement", "2026-11-03", -200))
        let atZero = line(HistoryFixture.movement("r0", "Remboursement", "2026-11-03", 0))

        #expect(achat.amount == "+\(Decimal(100).asCurrency(.chf))")
        #expect(remboursement.amount == "\u{2212}\(Decimal(200).asCurrency(.chf))")
        #expect(atZero.amount == Decimal(0).asCurrency(.chf))
    }

    /// A Restaurant of 80 CHF on a EUR account comes as −100 at a rate of 0.8, and without a rate.
    @Test
    func ca14_euroAsset_showsTheEffectInEuros_orADash() {
        let converted = line(HistoryFixture.movement("r", "Restaurant", "2026-11-05", -100), currency: .eur)
        let noRate = line(HistoryFixture.movement("r", "Restaurant", "2026-11-05", nil), currency: .eur)

        #expect(converted.amount == "\u{2212}100,00 €")
        #expect(noRate.amount == nil)
    }

    @Test
    func samePrevisionInTwoPeriods_hasTwoIdentities() {
        let above = HistoryFixture.movement("courses", "Courses", "2026-11-04", -280)
        let below = HistoryFixture.movement("courses", "Courses", "2026-10-28", -120, supersededAt: "2026-11-01")

        #expect(above.id != below.id)
    }
}

/// PUL-380: the line under the value of the detail, CA1 « Fin novembre : 8 000 ».
@Suite("AssetMonthEndProjection label")
struct AssetMonthEndProjectionLabelTests {
    private let projection = AssetMonthEndProjection(month: 11, year: 2026, value: 8000)

    @Test(arguments: [
        (SupportedLocale.fr, "Fin novembre : 8\u{2019}000.00 CHF"),
        (.en, "End of November: 8\u{2019}000.00 CHF"),
        (.de, "Ende November: 8\u{2019}000.00 CHF"),
        (.it, "Fine novembre: 8\u{2019}000.00 CHF"),
    ])
    func label_inEachLanguage(language: SupportedLocale, expected: String) {
        #expect(projection.label(currency: .chf, language: language) == expected)
    }

    @Test
    func label_signsANegativeProjectionLikeTheValue() {
        let overdrawn = AssetMonthEndProjection(month: 11, year: 2026, value: -250)
        #expect(overdrawn.label(currency: .chf, language: .fr) == "Fin novembre : \u{2212}250.00 CHF")
    }

    @Test(arguments: [
        (SupportedLocale.fr, "Fin novembre : 8\u{2019}000.00 CHF, si tout se passe comme prévu ce mois-ci"),
        (.en, "End of November: 8\u{2019}000.00 CHF, if everything goes as planned this month"),
        (.de, "Ende November: 8\u{2019}000.00 CHF, wenn diesen Monat alles wie geplant läuft"),
        (.it, "Fine novembre: 8\u{2019}000.00 CHF, se questo mese tutto va come previsto"),
    ])
    func accessibilityLabel_addsTheCondition(language: SupportedLocale, expected: String) {
        #expect(projection.accessibilityLabel(currency: .chf, language: language) == expected)
    }
}
