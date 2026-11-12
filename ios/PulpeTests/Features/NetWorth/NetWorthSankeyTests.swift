import Foundation
@testable import Pulpe
import Testing

/// The cases of the web's `net-worth-sankey.flows.spec.ts`.
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

    private let twoTypes = [
        AssetCategory(id: "c-checking", name: "Comptes", total: 900),
        AssetCategory(id: "c-savings", name: "Épargne", total: 100),
    ]

    @Test func flowsEachTypeIntoGross_thenGrossIntoNetAndTheDebtTypes() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 900),
            asset("s", "Livret", category: savings, value: 100),
            asset("c", "Leasing", category: savings, direction: .owe, value: 300),
        ], gross: 1000, debts: 300, net: 700, categories: twoTypes)))

        #expect(graph.flows == [
            flow("category:\(checking)", "gross", 900),
            flow("category:\(savings)", "gross", 100),
            flow("gross", "debt:\(savings)", 300),
            flow("gross", "net", 700),
        ])
        #expect(graph.nodes["debt:\(savings)"] == .init(kind: .debt, name: "Épargne", value: 300))
        #expect(graph.nodes["net"] == .init(kind: .net, name: nil, value: 700))
    }

    @Test func keepsOneLeftNodePerType_howeverManyElementsThereAre() throws {
        let types = ["c1", "c2", "c3"]
        let assets = (0..<25).map { asset("a\($0)", "Avoir \($0)", category: types[$0 % 3], value: 100) }
        let graph = try #require(NetWorthSankey.build(netWorth(
            assets, gross: 2500, debts: 0, net: 2500,
            categories: [
                AssetCategory(id: "c1", name: "Comptes", total: 900),
                AssetCategory(id: "c2", name: "Épargne", total: 800),
                AssetCategory(id: "c3", name: "Placements", total: 800),
            ]
        )))

        #expect(graph.order == ["category:c1", "category:c2", "category:c3", "gross", "net"])
    }

    @Test func drawsNothingWhenASingleTypeAndNoDebtLeaveNothingToSplit() {
        let single = netWorth(
            [asset("a", "UBS", value: 900), asset("b", "Cash", value: 100)], gross: 1000, debts: 0, net: 1000
        )

        #expect(NetWorthSankey.build(single) == nil)
    }

    @Test func coversDebtsBeyondGrossWithAShortfallBesideGross() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 1000),
            asset("c", "Prêt", direction: .owe, value: 3000),
            asset("d", "Leasing", category: savings, direction: .owe, value: 1000),
        ], gross: 1000, debts: 4000, net: -3000, categories: [
            AssetCategory(id: checking, name: "Comptes", total: 1000),
            AssetCategory(id: savings, name: "Leasing", total: 0),
        ])))

        // Each debt Type is drawn at its real size: gross covers a quarter of it.
        #expect(graph.flows.contains(flow("gross", "debt:\(checking)", 750)))
        #expect(graph.flows.contains(flow("net", "debt:\(checking)", 2250)))
        #expect(graph.flows.contains(flow("gross", "debt:\(savings)", 250)))
        #expect(graph.flows.contains(flow("net", "debt:\(savings)", 750)))
        #expect(graph.nodes["net"] == .init(kind: .shortfall, name: nil, value: 3000))
        #expect(graph.columns == ["net": 1])
        #expect(graph.priorities == ["gross": 0, "net": 1])
        #expect(graph.hasShortfall)
    }

    @Test func gathersTheOverdrawnAccountsInOneNodeOnTheDebtsSide() throws {
        let graph = try #require(NetWorthSankey.build(netWorth([
            asset("a", "UBS", value: 1000),
            asset("o", "Compte courant", value: -300),
            asset("p", "Compte joint", category: savings, value: -100),
        ], gross: 1000, debts: 400, net: 600)))

        let overdrafts = "debt:\(NetWorthSections.overdraftsId)"
        #expect(graph.flows == [
            flow("category:\(checking)", "gross", 1000),
            flow("gross", overdrafts, 400),
            flow("gross", "net", 600),
        ])
        #expect(graph.nodes[overdrafts]?.value == 400)
    }

    @Test func skipsArchivedAndUnconvertedAssetsAndTypesLeftEmpty() throws {
        let graph = try #require(NetWorthSankey.build(netWorth(
            [
                asset("a", "UBS", value: 500),
                asset("x", "Ancien", category: savings, value: 200, archived: true),
                asset("e", "Livret EUR", category: "c-foreign", value: nil, currency: .eur),
                asset("d", "Leasing", direction: .owe, value: 100),
            ],
            gross: 500, debts: 100, net: 400,
            categories: [
                AssetCategory(id: checking, name: "Comptes", total: 500),
                AssetCategory(id: savings, name: "Épargne", total: 0),
                AssetCategory(id: "c-foreign", name: "Étranger", total: 0),
            ]
        )))

        #expect(Set(graph.nodes.keys) == ["category:\(checking)", "debt:\(checking)", "gross", "net"])
    }

    @Test func drawsNothingWhenThereIsNoGross() {
        #expect(NetWorthSankey.build(netWorth([], gross: 0, debts: 0, net: 0, categories: [])) == nil)
    }
}
