import SwiftUI

/// Tour 11 "Activité" — recent transactions with a 7j/Mois window toggle,
/// the only variateur that maps to real usage.
struct ActivityCard: View {
    let transactions: [Transaction]
    var tagNamesById: [String: String] = [:]
    var onViewAll: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
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

            rows(for: windowed)
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: window)
    }

    // MARK: - Header

    private func header(for windowed: [Transaction]) -> some View {
        // The title, the total and the two controls share one line's width, and past
        // `xxLarge` the total is what gives: `+4 871 CHF` becomes `+4 871 C…`, and an
        // amount cut off its currency is not an amount. Stacked, it owns the full width.
        let isStacked = dynamicTypeSize >= .xxLarge

        return Group {
            if isStacked {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    titleBlock(for: windowed, isStacked: true)

                    HStack(spacing: DesignTokens.Spacing.md) {
                        windowToggle
                        Spacer()
                        viewAllButton
                    }
                }
            } else {
                HStack(spacing: DesignTokens.Spacing.md) {
                    titleBlock(for: windowed, isStacked: false)

                    Spacer()

                    // Tight trailing cluster: the chevron's 44pt tap box carries ~36pt of
                    // dead space to the left of its glyph, so the usual `md` gap would read
                    // as a void. Stacked, the row is wide enough that the gap is a Spacer.
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        windowToggle
                        viewAllButton
                    }
                }
            }
        }
        // Asymmetric on purpose: the heading is pushed away from the section above it and
        // held close to the rows it introduces, so proximity alone groups them.
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    private func titleBlock(for windowed: [Transaction], isStacked: Bool) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text("Activité")
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.textPrimary)

            Text(headerTotal(for: windowed))
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                // One line while the controls sit beside it — otherwise the total pushes
                // them off the row. Once it has the row to itself, wrapping is what keeps
                // the currency attached to its digits.
                .lineLimit(isStacked ? nil : 1)
                .contentTransition(.numericText())
                .sensitiveAmount()
        }
    }

    private var viewAllButton: some View {
        Button(action: onViewAll) {
            // Centring the glyph in that box would leave it ~18pt left of the chevrons on
            // the hero and à-pointer cards (bare Images flush to the same padding). Pin it
            // trailing; the hit area is unchanged.
            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)
                .frame(minWidth: DesignTokens.TapTarget.minimum, alignment: .trailing)
        }
        .iconButtonStyle()
        .accessibilityLabel("Voir toutes les transactions")
    }

    /// Two-segment window selector, each segment addressable on its own: tapping the
    /// active one is a no-op rather than a flip. Speaks `CapsulePicker`'s selection
    /// language — filled `pulpePrimary` for the active option, hairline outline for the
    /// other — because that is what selection looks like everywhere else in the app.
    /// The track it used to sit in was `surfaceContainerHigh`, a warm neutral that read
    /// as a stain on the cool `homeBackground`; two pills carry the choice without it.
    private var windowToggle: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(Window.allCases, id: \.self) { option in
                windowSegment(option)
            }
        }
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
                .foregroundStyle(isSelected ? Color.textOnPrimary : Color.textSecondary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                // Vertical padding stays under the horizontal one: at `sm` the short
                // "7j" rounded into a circle next to a capsule "Mois", two shapes for
                // one control.
                .padding(.horizontal, DesignTokens.Spacing.compactGap)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .background(isSelected ? Color.pulpePrimary : .clear, in: Capsule())
                .overlay {
                    if !isSelected {
                        Capsule().strokeBorder(
                            Color.onSurfaceVariant.opacity(DesignTokens.Opacity.outlinePill),
                            lineWidth: DesignTokens.BorderWidth.thin
                        )
                    }
                }
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
            // No rules between rows: each one is a name over a date with an amount opposite,
            // and the 24pt between rows against the 2pt inside one already says where a row
            // ends. A hairline on top of that only adds ledger-paper texture.
            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(windowed.prefix(Self.maxRows)) { transaction in
                    row(transaction)
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
