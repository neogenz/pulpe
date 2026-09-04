import SwiftUI

// MARK: - Operation Row

extension UncheckedOperationsCard {
    func operationRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        // Opposite ends while the row can hold both. Past `xxLarge` it cannot, and the
        // one-line rule that keeps the amount from wrapping is what cuts the label down
        // to "Logement…". Stacked, each owns the width and the rule protects nothing.
        let isStacked = dynamicTypeSize >= .xxLarge

        return HStack(spacing: DesignTokens.Spacing.lg) {
            RowIcon(systemName: item.kind.icon, tint: item.kind.color)

            if isStacked {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    operationLabel(item, isStacked: true)
                    tagChips(item, isStacked: true)
                    operationAmount(item)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                operationLabel(item, isStacked: false)

                tagChips(item, isStacked: false)

                Spacer(minLength: DesignTokens.Spacing.sm)

                operationAmount(item)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("homeUncheckedOperationRow")
    }

    /// Trails the label while the row holds both; stacked it takes the line under it,
    /// where a chip that followed a wrapped label would sit alone at the end of a
    /// half-empty line. The separator goes with that move: it exists to join the count
    /// to text already on its line, and there is none to join once the count has a line
    /// of its own.
    @ViewBuilder
    private func tagChips(_ item: CurrentMonthStore.CheckableItem, isStacked: Bool) -> some View {
        let names = Self.tagNames(for: item, namesById: tagNamesById)
        if !names.isEmpty {
            TagChips(names: names, presentation: .count, followsText: !isStacked)
        }
    }

    private func operationLabel(
        _ item: CurrentMonthStore.CheckableItem,
        isStacked: Bool
    ) -> some View {
        // Two Texts, not one concatenation: with a disc opening the row, the name owns
        // the first line and its metadata sits under it, the way every other row on the
        // screen is built. Concatenated, the metadata was also the first thing truncated.
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(item.name)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(isStacked ? nil : 1)
                // The rhythm rides the name, because only one of the two rhythms has a
                // glyph: on screen a ponctuel forecast is marked by the absence of the
                // arrows, and an absence says nothing out loud.
                .accessibilityLabel(Self.spokenName(for: item))

            // The rhythm opens the subtitle as a glyph rather than closing it as a word:
            // spelled out, a monthly forecast read "Prévu ce mois · Mensuel".
            HStack(spacing: DesignTokens.Spacing.xs) {
                if let icon = Self.recurrence(for: item)?.icon {
                    // Decorative: the title above speaks the rhythm for both.
                    Image(systemName: icon)
                        .accessibilityHidden(true)
                }

                Text(Self.subtitle(for: item))
                    .lineLimit(isStacked ? nil : 1)
            }
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textSecondary)
        }
    }

    private func operationAmount(_ item: CurrentMonthStore.CheckableItem) -> some View {
        Text(Self.amountText(for: item, in: currency))
            .font(PulpeTypography.amountMedium)
            .foregroundStyle(Color.textPrimary)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.compact)
            .sensitiveAmount()
    }
}
