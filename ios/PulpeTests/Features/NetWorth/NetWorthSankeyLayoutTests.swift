import CoreGraphics
import Foundation
@testable import Pulpe
import Testing

struct NetWorthSankeyLayoutTests {
    private let size = CGSize(width: 320, height: DesignTokens.Chart.sankeyHeight)

    private func graph(
        debts: Decimal = 300, net: Decimal = 700, gross: Decimal = 1000, owed: Decimal = 300
    ) throws -> NetWorthSankey.Graph {
        let assets = [
            TestDataFactory.makeAsset(id: "a", categoryId: "c1", name: "UBS", latestValue: 900),
            TestDataFactory.makeAsset(id: "b", categoryId: "c1", name: "Cash", latestValue: 100),
            TestDataFactory.makeAsset(id: "d", name: "Leasing", direction: .owe, latestValue: owed),
        ]
        return try #require(NetWorthSankey.build(NetWorth(
            totals: NetWorthTotals(baseCurrency: .chf, gross: gross, debts: debts, net: net, incomplete: false),
            categories: [AssetCategory(id: "c1", name: "Comptes", total: gross)],
            assets: assets
        )))
    }

    @Test func nodeHeightsAreProportionalToTheirFlow() throws {
        let result = NetWorthSankeyLayout.layout(try graph(), in: size)
        let height = { (id: String) in result.nodes.first { $0.id == id }?.rect.height ?? 0 }

        #expect(abs(height("asset:a") / height("asset:b") - 9) < 0.001)
        #expect(abs(height("gross") / height("net") - 1000.0 / 700.0) < 0.001)
    }

    @Test func nodesOfAColumnNeverOverlapAndStayInsideTheHeight() throws {
        let result = NetWorthSankeyLayout.layout(try graph(debts: 4000, net: -3000, owed: 4000), in: size)

        for column in 0..<result.columnCount {
            let rects = result.nodes.filter { $0.column == column }.map { $0.rect }.sorted { $0.minY < $1.minY }
            for (above, below) in zip(rects, rects.dropFirst()) { #expect(above.maxY <= below.minY) }
            #expect(rects.allSatisfy { $0.minY >= 0 && $0.maxY <= size.height + 0.001 })
        }
    }

    @Test func bandsStartAndEndOnTheirNodeFrames() throws {
        let result = NetWorthSankeyLayout.layout(try graph(), in: size)

        for band in result.bands {
            let source = try #require(result.nodes.first { $0.id == band.from }).rect
            let target = try #require(result.nodes.first { $0.id == band.to }).rect
            #expect(band.sourceTop >= source.minY - 0.001 && band.sourceTop + band.thickness <= source.maxY + 0.001)
            #expect(band.targetTop >= target.minY - 0.001 && band.targetTop + band.thickness <= target.maxY + 0.001)
            let bounds = band.path.boundingRect
            #expect(abs(bounds.minX - source.maxX) < 0.001 && abs(bounds.maxX - target.minX) < 0.001)
        }
    }

    @Test func tinyFlowsKeepTheMinimumNodeHeight() throws {
        let result = NetWorthSankeyLayout.layout(try graph(gross: 100_000), in: size)

        #expect(result.nodes.allSatisfy { $0.rect.height >= DesignTokens.Chart.sankeyMinNodeHeight })
    }

    @Test(arguments: [false, true])
    func middleLabelsNeverTouchANodeOrAnotherLabel(overdraft: Bool) throws {
        let assets = [
            TestDataFactory.makeAsset(id: "a", categoryId: "c1", name: "UBS", latestValue: 900),
            TestDataFactory.makeAsset(id: "b", categoryId: "c1", name: "Cash", latestValue: 100),
            TestDataFactory.makeAsset(id: "c", categoryId: "c2", name: "Livret", latestValue: 700),
            TestDataFactory.makeAsset(id: "e", categoryId: "c2", name: "Or", latestValue: 300),
            TestDataFactory.makeAsset(id: "d", name: "Leasing", direction: .owe, latestValue: overdraft ? 3000 : 400),
        ]
        let graph = try #require(NetWorthSankey.build(NetWorth(
            totals: NetWorthTotals(
                baseCurrency: .chf, gross: 2000, debts: overdraft ? 3000 : 400, net: overdraft ? -1000 : 1600,
                incomplete: false
            ),
            categories: [
                AssetCategory(id: "c1", name: "Comptes", total: 1000),
                AssetCategory(id: "c2", name: "Épargne", total: 1000),
            ],
            assets: assets
        )))
        // The card never draws narrower than its minimum width, and the headroom above holds the first pills.
        let drawn = CGSize(
            width: DesignTokens.Chart.sankeyMinWidth, height: size.height - DesignTokens.Chart.sankeyLabelHeadroom
        )
        let result = NetWorthSankeyLayout.layout(graph, in: drawn)
        let labels = result.nodes.compactMap { frame in frame.labelRect.map { (frame.id, $0) } }

        #expect(labels.count >= 3)
        for (id, label) in labels {
            #expect(label.minY >= -DesignTokens.Chart.sankeyLabelHeadroom)
            for node in result.nodes { #expect(!label.intersects(node.rect), "\(id) label covers \(node.id)") }
            for (other, rect) in labels where other != id { #expect(!label.intersects(rect)) }
        }
    }

    @Test func sevenCategoriesStayInsideTheReturnedFrameWithClearLabels() throws {
        var assets: [Asset] = []
        var categories: [AssetCategory] = []
        for index in 1...7 {
            categories.append(AssetCategory(id: "c\(index)", name: "Cat \(index)", total: 1000))
            for part in 1...2 {
                assets.append(TestDataFactory.makeAsset(
                    id: "a\(index)\(part)", categoryId: "c\(index)", name: "Avoir \(index)\(part)",
                    latestValue: part == 1 ? 900 : 100
                ))
            }
        }
        assets.append(TestDataFactory.makeAsset(id: "d", name: "Leasing", direction: .owe, latestValue: 2000))
        let graph = try #require(NetWorthSankey.build(NetWorth(
            totals: NetWorthTotals(baseCurrency: .chf, gross: 7000, debts: 2000, net: 5000, incomplete: false),
            categories: categories, assets: assets
        )))
        let headroom = DesignTokens.Chart.sankeyLabelHeadroom
        let drawn = CGSize(width: DesignTokens.Chart.sankeyMinWidth, height: DesignTokens.Chart.sankeyHeight - headroom)
        let result = NetWorthSankeyLayout.layout(graph, in: drawn)
        let frame = CGRect(x: 0, y: -headroom, width: drawn.width, height: result.height + headroom)
            .insetBy(dx: -0.001, dy: -0.001)
        let labels = result.nodes.compactMap { node in node.labelRect.map { (node.id, $0) } }

        #expect(result.height > drawn.height)
        #expect(result.height >= NetWorthSankeyLayout.requiredHeight(graph))
        for node in result.nodes { #expect(frame.contains(node.rect), "\(node.id) clipped") }
        for (id, label) in labels {
            #expect(frame.contains(label), "\(id) label clipped")
            for node in result.nodes { #expect(!label.intersects(node.rect), "\(id) label covers \(node.id)") }
            for (other, rect) in labels where other != id { #expect(!label.intersects(rect)) }
        }
    }
}
