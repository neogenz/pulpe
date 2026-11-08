import Foundation
@testable import Pulpe
import Testing

/// The six cases of the web's `net-worth-sankey.flows.spec.ts`.
struct NetWorthSankeyTests {
    private let checking = "c-checking"
    private let savings = "c-savings"

    private func asset(
        _ id: String,
        _ name: String,
        category: String? = nil,
        direction: AssetDirection = .own,
        value: Decimal?,
        archived: Bool = false,
        currency: SupportedCurrency = .chf
    ) -> Asset {
        Asset(
            id: id, categoryId: category ?? checking, name: name, currency: currency, direction: direction,
            inPulpe: false, archivedAt: archived ? TestDataFactory.fixedDate : nil, latestValue: value ?? 0,
            latestRecordedAt: TestDataFactory.fixedDate, convertedValue: value, suggestion: nil
        )
    }

    private func netWorth(
        _ assets: [Asset], gross: Decimal, debts: Decimal, net: Decimal, categories: [AssetCategory]? = nil
    ) -> NetWorth {
        NetWorth(
            totals: NetWorthTotals(baseCurrency: .chf, gross: gross, debts: debts, net: net, incomplete: false),
            categories: categories ?? [AssetCategory(id: checking, name: "Comptes", total: gross)],
            assets: assets
        )
    }

    private func flow(_ from: String, _ to: String, _ value: Double) -> NetWorthSankey.Flow {
        NetWorthSankey.Flow(from: from, to: to, flow: value)
    }

    @Test func flowsAssetsIntoTheirCategoryThenGrossThenNetAndDebts() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 900),
            asset("b", "Cash", value: 100),
            asset("c", "Leasing", direction: .owe, value: 300),
        ], gross: 1000, debts: 300, net: 700)))

        #expect(graph.flows == [
            flow("asset:a", "category:\(checking)", 900),
            flow("asset:b", "category:\(checking)", 100),
            flow("gross", "debt:c", 300),
            flow("category:\(checking)", "gross", 1000),
            flow("gross", "net", 700),
        ])
        #expect(graph.nodes["debt:c"] == .init(kind: .debt, name: "Leasing", value: 300))
        #expect(graph.nodes["net"] == .init(kind: .net, name: nil, value: 700))
    }

    @Test func coversDebtsBeyondGrossWithAShortfallBesideGross() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 1000),
            asset("c", "Prêt", direction: .owe, value: 3000),
            asset("d", "Leasing", direction: .owe, value: 1000),
        ], gross: 1000, debts: 4000, net: -3000)))

        // Each debt is drawn at its real size: gross covers a quarter of it.
        #expect(graph.flows.contains(flow("gross", "debt:c", 750)))
        #expect(graph.flows.contains(flow("net", "debt:c", 2250)))
        #expect(graph.flows.contains(flow("gross", "debt:d", 250)))
        #expect(graph.flows.contains(flow("net", "debt:d", 750)))
        #expect(graph.nodes["net"] == .init(kind: .shortfall, name: nil, value: 3000))
        #expect(graph.columns == ["net": 1])
        #expect(graph.priorities == ["gross": 0, "net": 1])
        #expect(graph.hasShortfall)
    }

    @Test func flowsAssetsStraightIntoGrossWhenNoCategoryHoldsTwoOfThem() throws {
        let graph = try #require(NetWorthSankey.build(netWorth(
            [asset("a", "UBS", value: 900), asset("s", "Livret", category: savings, value: 100)],
            gross: 1000, debts: 0, net: 1000,
            categories: [
                AssetCategory(id: checking, name: "Comptes", total: 900),
                AssetCategory(id: savings, name: "Épargne", total: 100),
            ]
        )))

        #expect(graph.flows == [
            flow("asset:a", "gross", 900),
            flow("asset:s", "gross", 100),
            flow("gross", "net", 1000),
        ])
        #expect(!graph.nodes.values.contains { $0.kind == .category })
    }

    @Test func sendsAnOverdrawnOwnAssetToTheDebtsSideOutOfItsCategory() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 1000),
            asset("o", "Compte courant", value: -300),
        ], gross: 1000, debts: 300, net: 700)))

        #expect(!graph.flows.contains { $0.from == "asset:o" })
        #expect(graph.flows.contains(flow("gross", "debt:o", 300)))
        #expect(graph.nodes["debt:o"]?.kind == .debt)
    }

    @Test func skipsArchivedAndUnconvertedAssetsAndEmptyCategories() throws {
        let graph = try #require(NetWorthSankey.build(netWorth(
            [
                asset("a", "UBS", value: 500),
                asset("x", "Ancien", category: savings, value: 200, archived: true),
                asset("e", "Livret EUR", value: nil, currency: .eur),
            ],
            gross: 500, debts: 0, net: 500,
            categories: [
                AssetCategory(id: checking, name: "Comptes", total: 500),
                AssetCategory(id: savings, name: "Épargne", total: 0),
            ]
        )))

        #expect(Set(graph.nodes.keys) == ["asset:a", "gross", "net"])
        #expect(graph.flows.count == 2)
    }

    @Test func drawsNothingWhenThereIsNoGross() {
        #expect(NetWorthSankey.build(netWorth([], gross: 0, debts: 0, net: 0, categories: [])) == nil)
    }
}
