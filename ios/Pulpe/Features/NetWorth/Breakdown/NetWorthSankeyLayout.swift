import SwiftUI

/// Geometry of the breakdown diagram, free of any view: one column per depth, node heights
/// proportional to the flow through them on one shared scale, link bands stacked on the nodes.
enum NetWorthSankeyLayout {
    struct NodeFrame: Equatable {
        let id: String
        let kind: NetWorthSankey.Kind
        let column: Int
        let rect: CGRect
    }

    struct LinkBand {
        let from: String
        let to: String
        let sourceKind: NetWorthSankey.Kind
        let targetKind: NetWorthSankey.Kind
        let sourceTop: CGFloat
        let targetTop: CGFloat
        let thickness: CGFloat
        let path: Path
    }

    struct Result {
        let nodes: [NodeFrame]
        let bands: [LinkBand]
        let columnCount: Int
    }

    /// `labelWidth` is kept free on both sides for the first and last column labels.
    static func layout(
        _ graph: NetWorthSankey.Graph,
        in size: CGSize,
        labelWidth: CGFloat = DesignTokens.Chart.sankeyLabelWidth
    ) -> Result {
        let nodeWidth = DesignTokens.Chart.sankeyNodeWidth
        let gap = DesignTokens.Chart.sankeyNodeGap
        let minHeight = DesignTokens.Chart.sankeyMinNodeHeight
        let columns = columnIndexes(graph)
        let columnCount = (columns.values.max() ?? 0) + 1
        let ordered = orderedColumns(graph, columns: columns, columnCount: columnCount)

        // What flows through a node: the larger of what enters and what leaves.
        var through: [String: Double] = [:]
        for id in graph.order {
            let incoming = graph.flows.filter { $0.to == id }.reduce(0) { $0 + $1.flow }
            let outgoing = graph.flows.filter { $0.from == id }.reduce(0) { $0 + $1.flow }
            through[id] = max(incoming, outgoing)
        }

        let scale = sharedScale(ordered: ordered, through: through, height: size.height, gap: gap, minHeight: minHeight)
        let left = labelWidth
        let step = columnCount > 1 ? (size.width - 2 * labelWidth - nodeWidth) / CGFloat(columnCount - 1) : 0

        var rects: [String: CGRect] = [:]
        var frames: [NodeFrame] = []
        for (column, ids) in ordered.enumerated() {
            let heights = ids.map { max(CGFloat(through[$0] ?? 0) * scale, minHeight) }
            let total = heights.reduce(0, +) + gap * CGFloat(max(ids.count - 1, 0))
            var y = (size.height - total) / 2
            for (id, height) in zip(ids, heights) {
                let rect = CGRect(x: left + step * CGFloat(column), y: y, width: nodeWidth, height: height)
                rects[id] = rect
                frames.append(NodeFrame(id: id, kind: graph.nodes[id]?.kind ?? .asset, column: column, rect: rect))
                y += height + gap
            }
        }

        return Result(nodes: frames, bands: bands(graph, rects: rects, scale: scale), columnCount: columnCount)
    }

    // MARK: - Columns

    private static func columnIndexes(_ graph: NetWorthSankey.Graph) -> [String: Int] {
        var columns = Dictionary(uniqueKeysWithValues: graph.order.map { ($0, graph.columns[$0] ?? 0) })
        // Longest path from the sources; a pinned node keeps its column.
        for _ in graph.order {
            for flow in graph.flows where graph.columns[flow.to] == nil {
                columns[flow.to] = max(columns[flow.to] ?? 0, (columns[flow.from] ?? 0) + 1)
            }
        }
        return columns
    }

    private static func orderedColumns(
        _ graph: NetWorthSankey.Graph, columns: [String: Int], columnCount: Int
    ) -> [[String]] {
        var result = (0..<columnCount).map { column in
            graph.order.filter { columns[$0] == column }.enumerated().sorted {
                let (lhs, rhs) = (graph.priorities[$0.element] ?? 0, graph.priorities[$1.element] ?? 0)
                return lhs == rhs ? $0.offset < $1.offset : lhs < rhs
            }.map(\.element)
        }
        // The first column follows its targets, so the bands do not cross needlessly.
        if columnCount > 1 {
            var position: [String: Int] = [:]
            for ids in result[1...] { for (index, id) in ids.enumerated() { position[id] = index } }
            func targetPosition(_ id: String) -> Int {
                graph.flows.first { $0.from == id }.flatMap { position[$0.to] } ?? 0
            }
            result[0] = result[0].enumerated().sorted { lhs, rhs in
                let (left, right) = (targetPosition(lhs.element), targetPosition(rhs.element))
                return left == right ? lhs.offset < rhs.offset : left < right
            }.map(\.element)
        }
        return result
    }

    /// One scale for every column, shrunk until the tallest one (gaps and minimum heights
    /// included) fits the height.
    private static func sharedScale(
        ordered: [[String]], through: [String: Double], height: CGFloat, gap: CGFloat, minHeight: CGFloat
    ) -> CGFloat {
        var scale = CGFloat.greatestFiniteMagnitude
        for ids in ordered {
            let total = ids.reduce(0) { $0 + (through[$1] ?? 0) }
            let free = height - gap * CGFloat(max(ids.count - 1, 0))
            if total > 0 { scale = min(scale, free / CGFloat(total)) }
        }
        guard scale.isFinite else { return 0 }
        func columnHeight(_ ids: [String]) -> CGFloat {
            var total = gap * CGFloat(max(ids.count - 1, 0))
            for id in ids { total += max(CGFloat(through[id] ?? 0) * scale, minHeight) }
            return total
        }
        for _ in 0..<12 {
            let overflow = ordered.map(columnHeight).max() ?? 0
            if overflow <= height { break }
            scale *= max(height / overflow, 0.5)
        }
        return scale
    }

    // MARK: - Bands

    private static func bands(
        _ graph: NetWorthSankey.Graph, rects: [String: CGRect], scale: CGFloat
    ) -> [LinkBand] {
        let sourceTop = stackedTops(graph, rects: rects, scale: scale, atSource: true)
        let targetTop = stackedTops(graph, rects: rects, scale: scale, atSource: false)

        return graph.flows.enumerated().compactMap { index, flow in
            guard let from = rects[flow.from], let to = rects[flow.to],
                  let sy = sourceTop[index], let ty = targetTop[index] else { return nil }
            let thickness = CGFloat(flow.flow) * scale
            return LinkBand(
                from: flow.from, to: flow.to,
                sourceKind: graph.nodes[flow.from]?.kind ?? .asset,
                targetKind: graph.nodes[flow.to]?.kind ?? .asset,
                sourceTop: sy, targetTop: ty, thickness: thickness,
                path: bandPath(x0: from.maxX, x1: to.minX, sy: sy, ty: ty, thickness: thickness)
            )
        }
    }

    /// Top of each band on one side: the bands of a node stack from its top, in the vertical
    /// order of the node at their other end.
    private static func stackedTops(
        _ graph: NetWorthSankey.Graph, rects: [String: CGRect], scale: CGFloat, atSource: Bool
    ) -> [Int: CGFloat] {
        func node(_ flow: NetWorthSankey.Flow) -> String { atSource ? flow.from : flow.to }
        func other(_ flow: NetWorthSankey.Flow) -> CGFloat { rects[atSource ? flow.to : flow.from]?.midY ?? 0 }
        var offsets: [String: CGFloat] = [:]
        var tops: [Int: CGFloat] = [:]
        let sorted = graph.flows.enumerated().sorted { lhs, rhs in
            let (left, right) = (node(lhs.element), node(rhs.element))
            if left != right { return left < right }
            let (leftY, rightY) = (other(lhs.element), other(rhs.element))
            return leftY == rightY ? lhs.offset < rhs.offset : leftY < rightY
        }
        for (index, flow) in sorted {
            let id = node(flow)
            tops[index] = (rects[id]?.minY ?? 0) + (offsets[id] ?? 0)
            offsets[id, default: 0] += CGFloat(flow.flow) * scale
        }
        return tops
    }

    private static func bandPath(x0: CGFloat, x1: CGFloat, sy: CGFloat, ty: CGFloat, thickness: CGFloat) -> Path {
        let mid = (x0 + x1) / 2
        var path = Path()
        path.move(to: CGPoint(x: x0, y: sy))
        path.addCurve(to: CGPoint(x: x1, y: ty), control1: CGPoint(x: mid, y: sy), control2: CGPoint(x: mid, y: ty))
        path.addLine(to: CGPoint(x: x1, y: ty + thickness))
        path.addCurve(
            to: CGPoint(x: x0, y: sy + thickness),
            control1: CGPoint(x: mid, y: ty + thickness), control2: CGPoint(x: mid, y: sy + thickness)
        )
        path.closeSubpath()
        return path
    }
}
