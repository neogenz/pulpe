import Foundation

/// Flow mapping of the « Répartition aujourd'hui » diagram: a port of the web's
/// `net-worth-sankey.flows.ts`. No money is computed here; widths come from the API figures
/// (`convertedValue`, category `total`, `totals`). The only arithmetic is the ratio of gross
/// over debts that splits a debt between gross and the shortfall when debts exceed gross.
enum NetWorthSankey {
    enum Kind: Equatable, Sendable {
        case asset, category, gross, net, shortfall, debt
    }

    struct Flow: Equatable, Sendable {
        let from: String
        let to: String
        let flow: Double
    }

    struct Node: Equatable, Sendable {
        let kind: Kind
        /// `nil` for the fixed nodes (gross, net, shortfall), which the card labels itself.
        let name: String?
        /// Worth in the base currency, for the label.
        let value: Decimal
    }

    struct Graph: Equatable, Sendable {
        let flows: [Flow]
        let nodes: [String: Node]
        /// Node ids in the web's insertion order: the default order inside a column.
        let order: [String]
        /// Pins a node to a column when the flows alone would misplace it.
        let columns: [String: Int]
        /// Orders nodes inside a column, lowest on top.
        let priorities: [String: Int]

        var hasShortfall: Bool { nodes[NetWorthSankey.netNode]?.kind == .shortfall }
    }

    static let grossNode = "gross"
    static let netNode = "net"

    /// `nil` when there is nothing to draw: no gross, or no own asset.
    static func build(_ netWorth: NetWorth) -> Graph? {
        let totals = netWorth.totals
        guard totals.gross > 0 else { return nil }

        var flows: [Flow] = []
        var nodes: [String: Node] = [:]
        var order: [String] = []
        func add(_ id: String, _ node: Node) {
            if nodes.updateValue(node, forKey: id) == nil { order.append(id) }
        }

        // Share of each debt that gross covers; the shortfall covers the rest.
        let covered = totals.net < 0 ? double(totals.gross) / double(totals.debts) : 1
        let owned = netWorth.assets.filter {
            $0.archivedAt == nil && $0.direction == .own && ($0.convertedValue ?? 0) > 0
        }
        guard !owned.isEmpty else { return nil }
        let categoryIds = Set(owned.map(\.categoryId))
        let hasCategoryColumn = categoryIds.count < owned.count

        for asset in owned {
            let id = "asset:\(asset.id)"
            let value = asset.convertedValue ?? 0
            add(id, Node(kind: .asset, name: asset.name, value: value))
            flows.append(Flow(
                from: id, to: hasCategoryColumn ? "category:\(asset.categoryId)" : grossNode, flow: double(value)
            ))
        }

        for debt in debts(netWorth.assets, covered: covered) {
            add(debt.id, debt.node)
            flows += debt.flows
        }

        if hasCategoryColumn {
            for category in netWorth.categories where categoryIds.contains(category.id) {
                let id = "category:\(category.id)"
                add(id, Node(kind: .category, name: category.name, value: category.total))
                flows.append(Flow(from: id, to: grossNode, flow: double(category.total)))
            }
        }

        add(grossNode, Node(kind: .gross, name: nil, value: totals.gross))
        if totals.net > 0 {
            add(netNode, Node(kind: .net, name: nil, value: totals.net))
            flows.append(Flow(from: grossNode, to: netNode, flow: double(totals.net)))
        }
        if totals.net < 0 {
            // « Il manque » reads as a magnitude, like the debts it covers. It has no inflow, so
            // it is pinned beside gross and under it, to keep the main flow on top.
            add(netNode, Node(kind: .shortfall, name: nil, value: totals.net.magnitude))
            return Graph(
                flows: flows, nodes: nodes, order: order,
                columns: [netNode: hasCategoryColumn ? 2 : 1],
                priorities: [grossNode: 0, netNode: 1]
            )
        }
        return Graph(flows: flows, nodes: nodes, order: order, columns: [:], priorities: [:])
    }

    private struct Debt {
        let id: String
        let node: Node
        let flows: [Flow]
    }

    /// Active `owe` assets and overdrawn `own` ones, drawn at their real size: gross covers
    /// `covered` of each, the shortfall node the rest.
    private static func debts(_ assets: [Asset], covered: Double) -> [Debt] {
        assets.filter { $0.archivedAt == nil }.compactMap { asset in
            guard let value = asset.convertedValue, value != 0, asset.direction == .owe || value < 0 else { return nil }
            let id = "debt:\(asset.id)"
            let magnitude = double(value.magnitude)
            var flows = [Flow(from: grossNode, to: id, flow: magnitude * covered)]
            if covered < 1 { flows.append(Flow(from: netNode, to: id, flow: magnitude * (1 - covered))) }
            return Debt(id: id, node: Node(kind: .debt, name: asset.name, value: value.magnitude), flows: flows)
        }
    }

    private static func double(_ value: Decimal) -> Double {
        NSDecimalNumber(decimal: value).doubleValue
    }
}
