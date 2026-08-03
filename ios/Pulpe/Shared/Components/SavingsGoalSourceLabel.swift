import SwiftUI

/// Where an income came from, on the metadata line of a transaction row (PUL-329).
///
/// Sits next to the date and the tag count rather than claiming a line of its own:
/// on a dense row the origin is context, not a headline. The broken state stays
/// neutral — a deleted goal is history, not an error, so nothing here turns red.
///
/// The detail surface uses `ContextLinkRow` instead: only there is the origin
/// navigable and explained.
struct SavingsGoalSourceLabel: View {
    let source: SavingsGoalSource
    /// Prepends the `·` separator when the label shares its line with preceding
    /// text, mirroring `TagChips` so both metadata never drift apart.
    var followsText = false

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            if followsText {
                Text("·")
            }
            Image(systemName: source.icon)
            // One line while the row stays dense; at accessibility sizes the name
            // matters more than the row's height, so it wraps instead of clipping.
            Text(source.label)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                .truncationMode(.tail)
        }
        .font(PulpeTypography.labelMedium)
        .foregroundStyle(source.isBroken ? Color.textTertiary : Color.financialSavings)
        // VoiceOver always gets the whole name, even when the visible line is cut.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(source.accessibilityLabel)
    }
}

// MARK: - Preview

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
        SavingsGoalSourceLabel(source: .active(goalId: "goal-1", name: "Maison"))
        SavingsGoalSourceLabel(source: .broken(name: "Appartement à Lausanne"))
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("12 janvier")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
            SavingsGoalSourceLabel(
                source: .active(goalId: "goal-1", name: "Maison"),
                followsText: true
            )
            TagChips(names: ["Vacances"], presentation: .count, followsText: true)
        }
    }
    .padding(DesignTokens.Spacing.lg)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
