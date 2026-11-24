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

    @Test
    func load_replacesWhatWasAppended() async {
        let service = pagedService()
        let model = makeModel(service)
        await model.load()
        await model.loadMore()

        await model.load()

        #expect(model.entries.count == 3)
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

    private func line(_ entry: AssetHistoryEntry, language: SupportedLocale = .fr) -> AssetHistoryLine {
        AssetHistoryLine(entry, currency: .chf, now: now, language: language)
    }

    private func day(_ iso: String, _ language: SupportedLocale = .fr) -> String {
        Formatters.dayMonthLabel(for: HistoryFixture.day(iso), in: language)
    }

    @Test
    func movement_readsNameDateAndSignedEffect() {
        let salaire = line(HistoryFixture.movement("s", "Salaire", "2026-11-10", 6000))
        let loyer = line(HistoryFixture.movement("l", "Loyer", "2026-11-03", -1500))

        #expect(salaire.accessibilityLabel(amountsHidden: false)
            == "Salaire, Pointé le \(day("2026-11-10")), +\(Decimal(6000).asCurrency(.chf))")
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
            == "Assurance, Pointé le \(day("2026-10-28")), Déjà compris dans ta saisie du 1er novembre")
    }

    @Test
    func movementWithoutRate_hasNoAmount() {
        let courses = line(HistoryFixture.movement("c", "Courses", "2026-11-04", nil))

        #expect(courses.amount == nil)
        #expect(courses.accessibilityLabel(amountsHidden: false) == "Courses, Pointé le \(day("2026-11-04"))")
    }

    @Test
    func english_translatesTheFixedWords() {
        let assurance = line(
            HistoryFixture.movement("a", "Assurance", "2026-10-28", -300, supersededAt: "2026-11-01"),
            language: .en
        )

        #expect(assurance.date == "Checked on \(day("2026-10-28", .en))")
        #expect(assurance.legend == "Already included in your entry on \(day("2026-11-01", .en))")
    }

    @Test
    func samePrevisionInTwoPeriods_hasTwoIdentities() {
        let above = HistoryFixture.movement("courses", "Courses", "2026-11-04", -280)
        let below = HistoryFixture.movement("courses", "Courses", "2026-10-28", -120, supersededAt: "2026-11-01")

        #expect(above.id != below.id)
    }
}
