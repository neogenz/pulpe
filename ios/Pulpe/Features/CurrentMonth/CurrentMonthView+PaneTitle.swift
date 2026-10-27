import SwiftUI

/// Beside the forest pane, a centred bar title straddles the seam, light ink half over the
/// light canvas; the hero already names the month. Pushed pages still read it for « back ».
struct PaneTitleRemoval: ViewModifier {
    let isRemoved: Bool

    func body(content: Content) -> some View {
        if isRemoved {
            content.toolbar(removing: .title)
        } else {
            content
        }
    }
}
