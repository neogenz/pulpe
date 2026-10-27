import SwiftUI

/// The open iPhone Duo's two panes: a list stays beside the page it opens, so picking another
/// row swaps the page instead of going back and forth. Two stacks rather than a
/// `NavigationSplitView`: on the Duo the split view keeps its own 320pt sidebar and, in
/// portrait, slides it over the page instead of beside it.
struct ListBesideDetail<List: View, Detail: View>: View {
    @ViewBuilder let list: List
    /// Brings its own `NavigationStack`, bound to the section's path.
    @ViewBuilder let detail: Detail

    var body: some View {
        HStack(spacing: 0) {
            NavigationStack {
                list
                    // The list never reaches the window's trailing edge, yet its stack inherits
                    // the landscape tab bar's inset there and squeezed every row by that much.
                    .ignoresSafeArea(.container, edges: .trailing)
            }
            .containerRelativeFrame(.horizontal) { width, _ in
                min(
                    max(width * DesignTokens.Layout.listPaneWidthRatio, DesignTokens.Layout.listPaneMinWidth),
                    DesignTokens.Layout.listPaneMaxWidth
                )
            }

            Divider()
                .ignoresSafeArea()

            detail
        }
        // Panes meet at a straight seam: a rounded corner beside the divider or the bar
        // reads as a stray curve, not as the zone's shape.
        .environment(\.contentZoneSquareCorners, [.leading, .trailing])
    }
}
