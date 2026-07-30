import SwiftUI

/// Tour 11 "Activité" — recent transactions with a 7j/Mois window toggle,
/// the only variateur that maps to real usage.
struct ActivityCard: View {
    let transactions: [Transaction]
    var tagNamesById: [String: String] = [:]
    var onViewAll: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var window: Window = .week

    private static let maxRows = 5

    enum Window: String, CaseIterable {
        case week = "7j"
        case month = "Mois"
    }

    private var filtered: [Transaction] {
        let sorted = transactions.sorted { $0.transactionDate > $1.transactionDate }
        guard window == .week,
              let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) else {
            return sorted
        }
        return sorted.filter { $0.transactionDate >= cutoff }
    }

    private func headerTotal(for windowed: [Transaction]) -> String {
        // Arithmetic net of the window: income positive, outflows negative.
        windowed
            .reduce(Decimal.zero) { $0 + ($1.kind == .income ? $1.amount : -$1.amount) }
            .asArithmeticSignedCompactCurrency(userSettingsStore.currency)
    }

    var body: some View {
        // Sort + filter once per render — as computed vars, header count, window total and
        // the rows each re-traversed all transactions.
        let windowed = filtered

        VStack(spacing: DesignTokens.Spacing.none) {
            header(for: windowed)

            Divider()

            rows(for: windowed)
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: window)
    }

    // MARK: - Header

    private func header(for windowed: [Transaction]) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Activité")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)

                Text(headerTotal(for: windowed))
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    .sensitiveAmount()
            }

            Spacer()

            // Tight trailing cluster: the chevron's 44pt tap box carries ~36pt of dead
            // space to the left of its glyph, so the usual `md` gap would read as a void.
            HStack(spacing: DesignTokens.Spacing.xs) {
                windowToggle

                Button(action: onViewAll) {
                    // Centring the glyph in that box would leave it ~18pt left of the
                    // chevrons on the hero and à-pointer cards (bare Images flush to the
                    // same padding). Pin it trailing; the hit area is unchanged.
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textTertiary)
                        .frame(minWidth: DesignTokens.TapTarget.minimum, alignment: .trailing)
                }
                .iconButtonStyle()
                .accessibilityLabel("Voir toutes les transactions")
            }
        }
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.md)
    }

    /// Two-segment window selector, each segment addressable on its own: tapping the
    /// active one is a no-op rather than a flip. Follows `CapsulePicker`'s shape — the
    /// pill is drawn inside the label so it stays compact while the button box is 44pt.
    private var windowToggle: some View {
        HStack(spacing: DesignTokens.Spacing.xxs) {
            ForEach(Window.allCases, id: \.self) { option in
                windowSegment(option)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xxs)
        .background(Color.surfaceContainerHigh, in: Capsule())
        .sensoryFeedback(.selection, trigger: window)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Période d'activité")
        .accessibilityValue(window == .week ? "7 derniers jours" : "Mois complet")
        .accessibilityHint("Bascule entre 7 jours et le mois")
    }

    private func windowSegment(_ option: Window) -> some View {
        let isSelected = window == option
        return Button {
            withAnimation(DesignTokens.Animation.smoothEaseOut) { window = option }
        } label: {
            // Unconstrained, "Mois" breaks to one letter per line at accessibility
            // sizes and the capsule collapses over "7j".
            Text(option.rawValue)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, DesignTokens.Spacing.compactGap)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .background(isSelected ? Color.surface : .clear, in: Capsule())
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .accessibilityLabel(option == .week ? "7 derniers jours" : "Mois complet")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Rows

    @ViewBuilder
    private func rows(for windowed: [Transaction]) -> some View {
        if windowed.isEmpty {
            Text("Aucune transaction sur cette période")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, DesignTokens.Spacing.lg)
        } else {
            VStack(spacing: DesignTokens.Spacing.none) {
                let visible = Array(windowed.prefix(Self.maxRows))
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, transaction in
                    row(transaction)
                    if index < visible.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.bottom, DesignTokens.Spacing.sm)
        }
    }

    private func row(_ transaction: Transaction) -> some View {
        HStack(alignment: .firstTextBaseline) {
            // Name and date are separate Texts, not one concatenation: a single
            // `lineLimit(1)` over "name · date" truncates the date away first, and the date
            // is what tells two same-named transactions apart ("test" vs "test 2").
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                HStack(spacing: DesignTokens.Spacing.xs) {
                    Text(transaction.transactionDate.relativeFormatted.lowercased())
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.compact)

                    let tagNames = TagChips.names(for: transaction.tagIds, namesById: tagNamesById)
                    if !tagNames.isEmpty {
                        TagChips(names: tagNames, presentation: .count, followsText: true)
                    }
                }
            }

            Spacer()

            amountColumn(transaction)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
    }

    /// Mock renders activity amounts in neutral ink (not kind-colored);
    /// the FX secondary line reuses the shared `TransactionAmountView` policy.
    private func amountColumn(_ transaction: Transaction) -> some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            Text(transaction.amount.asSignedAmount(for: transaction.kind, in: userSettingsStore.currency))
                .font(PulpeTypography.amountMedium)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)

            if let secondary = TransactionAmountView.secondaryText(
                for: transaction,
                in: userSettingsStore.currency
            ) {
                Text(secondary)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityLabel("saisi en \(secondary)")
            }
        }
        .sensitiveAmount()
    }
}
