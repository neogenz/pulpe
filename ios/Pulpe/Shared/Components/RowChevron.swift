import SwiftUI

/// The disclosure mark at the trailing edge of a tappable row: the promise, visible before
/// any gesture, that a tap opens something. Hidden from VoiceOver, which reads the row's
/// hint instead.
struct RowChevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Color.textTertiary)
            .padding(.leading, DesignTokens.Spacing.xs)
            .accessibilityHidden(true)
    }
}
