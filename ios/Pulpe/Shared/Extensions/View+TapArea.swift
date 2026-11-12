import SwiftUI

extension View {
    /// A 44pt hit area that leaves the layout alone: pad out, shape the hit area, pad back in
    /// (swiftui-hit-areas.md). For a control sharing a stack, where a frame would grow the row.
    func expandedTapArea(_ edges: Edge.Set = .vertical) -> some View {
        padding(edges, DesignTokens.TapTarget.minimum / 2)
            .contentShape(Rectangle())
            .padding(edges, -DesignTokens.TapTarget.minimum / 2)
    }
}
