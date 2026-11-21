import SwiftUI

/// Page dots of a short guided sequence, the current one stretched into a pill. VoiceOver reads
/// « Étape N sur M » and skips the dots themselves. `current` is zero-based.
struct StepDots: View {
    let current: Int
    let total: Int

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            ForEach(0..<total, id: \.self) { index in
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xs)
                    .fill(index == current ? Color.pulpePrimary : Color.outlineVariant)
                    .frame(
                        width: index == current ? DesignTokens.Spacing.xl : DesignTokens.Spacing.sm,
                        height: DesignTokens.Spacing.sm
                    )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AppLocale.string("Étape \(current + 1) sur \(total)"))
    }
}
