import Foundation

/// Flow mapping of the « Répartition aujourd'hui » diagram: a port of the web's
/// `net-worth-sankey.flows.ts`. Widths come from the API figures (`totals`, category `total`)
/// and from the debt Type totals of `NetWorthSections`. The only arithmetic is the ratio of gross
/// over debts that splits a debt between gross and the shortfall when debts exceed gross.
enum NetWorthSankey {
    enum Kind: Equatable, Sendable {
        case category, gross, net, shortfall, debt
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

    /// Each Type I own flows into gross; gross leaves on the debts side, one node per debt Type
    /// plus one for the overdrawn accounts, and into « Fortune nette » when net is positive.
    /// Elements are not drawn: the cards carry them, and the diagram stays readable however
    /// many there are. `nil` when there is nothing to split: no gross, or one Type and no debt.
    static func build(_ netWorth: NetWorth) -> Graph? {
        let totals = netWorth.totals
        guard totals.gross > 0 else { return nil }
        let sections = NetWorthSections(netWorth)
        let owned = sections.categories.filter { $0.total > 0 }
        let debts = sections.debtGroups.filter { $0.total > 0 }
        guard owned.count > 1 || !debts.isEmpty else { return nil }

        var flows: [Flow] = []
        var nodes: [String: Node] = [:]
        var order: [String] = []
        func add(_ id: String, _ node: Node) {
            if nodes.updateValue(node, forKey: id) == nil { order.append(id) }
        }

        for type in owned {
            let id = "category:\(type.id)"
            add(id, Node(kind: .category, name: type.name, value: type.total))
            flows.append(Flow(from: id, to: grossNode, flow: double(type.total)))
        }

        // Share of each debt that gross covers; the shortfall covers the rest.
        let covered = totals.net < 0 ? double(totals.gross) / double(totals.debts) : 1
        for debt in debts {
            let id = "debt:\(debt.id)"
            add(id, Node(kind: .debt, name: debt.name, value: debt.total))
            flows.append(Flow(from: grossNode, to: id, flow: double(debt.total) * covered))
            if covered < 1 { flows.append(Flow(from: netNode, to: id, flow: double(debt.total) * (1 - covered))) }
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
                columns: [netNode: 1], priorities: [grossNode: 0, netNode: 1]
            )
        }
        return Graph(flows: flows, nodes: nodes, order: order, columns: [:], priorities: [:])
    }

    private static func double(_ value: Decimal) -> Double {
        NSDecimalNumber(decimal: value).doubleValue
    }
}
