import SwiftUI

/// Tour 11 "Activité" — recent transactions grouped by day, under a 7 jours / Ce mois
/// window selector, the only variateur that maps to real usage.
struct ActivityCard: View {
    let transactions: [Transaction]
    var tagNamesById: [String: String] = [:]
    var onViewAll: () -> Void
    var onEdit: (Transaction) -> Void
    var onDelete: (Transaction) -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var window: Window = .week

    enum Window: String, CaseIterable {
        case week = "7 jours"
        case month = "Ce mois"

        /// The chip's copy. The raw value is the French wording this shipped with and is
        /// kept as the case's identity; only this reads off the catalog.
        var label: String {
            switch self {
            case .week: AppLocale.string("7 jours")
            case .month: AppLocale.string("Ce mois")
            }
        }
    }

    /// Per-window cap: the week is a chronological prefix of the month, so an equal cap
    /// made both windows render identical rows as soon as 5 operations fell in 7 days.
    private var maxRows: Int {
        switch window {
        case .week: 5
        case .month: 10
        }
    }

    /// One day's transactions, in the order the window already sorted them.
    private struct DayGroup: Identifiable {
        let id: Date
        let label: String
        let transactions: [Transaction]
    }

    private var filtered: [Transaction] {
        let sorted = transactions.sorted { $0.transactionDate > $1.transactionDate }
        guard window == .week,
              let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) else {
            return sorted
        }
        return sorted.filter { $0.transactionDate >= cutoff }
    }

    /// Buckets the visible rows by calendar day, newest day first. The cap is applied
    /// before grouping, so the screen still shows at most `maxRows` transactions however
    /// many days they fall across.
    private func dayGroups(for windowed: [Transaction]) -> [DayGroup] {
        let calendar = Calendar.current
        var order: [Date] = []
        var byDay: [Date: [Transaction]] = [:]

        for transaction in windowed.prefix(maxRows) {
            let day = calendar.startOfDay(for: transaction.transactionDate)
            if byDay[day] == nil { order.append(day) }
            byDay[day, default: []].append(transaction)
        }

        return order.map { day in
            DayGroup(
                id: day,
                label: day.relativeFormatted,
                transactions: byDay[day] ?? []
            )
        }
    }

    private func headerTotal(for windowed: [Transaction]) -> String {
        // Arithmetic net of the window: income positive, outflows negative.
        windowed
            .reduce(Decimal.zero) { $0 + ($1.kind == .income ? $1.amount : -$1.amount) }
            .asArithmeticSignedCompactCurrency(userSettingsStore.currency)
    }

    var body: some View {
        // Sort, filter and group once per render — as computed vars, the header total and
        // the rows each re-traversed all transactions.
        let windowed = filtered
        let groups = dayGroups(for: windowed)

        // ponytail: spike — emits sections into the home's List instead of drawing a card:
        // the rows are stock inset-grouped cells, the one shape iOS paints swipe chrome on.
        Group {
            Section {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    SectionHeader(
                        title: AppLocale.string("Activité"),
                        amountSubtitle: headerTotal(for: windowed),
                        link: (label: AppLocale.string("Tout voir"), action: onViewAll)
                    )

                    // Its own row, full width: squeezed into the heading it fought the title
                    // for the line and had to be re-stacked by hand past `xxLarge`.
                    windowPicker
                }
                // Clear of the section corner's arc, like every heading on the canvas.
                .padding(.top, DesignTokens.Spacing.xl)
                .listRowCustomStyled(insets: EdgeInsets())
                .accessibilityIdentifier("homeActivityCard")
            }

            if groups.isEmpty {
                Section { emptyState }
            } else {
                ForEach(groups) { group in
                    Section {
                        ForEach(group.transactions) { transaction in
                            row(transaction)
                        }
                    } header: {
                        // The day is said once, over its rows, and keeps the header trait
                        // so VoiceOver can jump by day.
                        Text(group.label)
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.textTertiary)
                            .textCase(nil)
                    }
                }
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: window)
    }

    // MARK: - Window Picker

    /// A 1-of-N choice, so the app's single segmented control (The Three Families Rule).
    private var windowPicker: some View {
        SegmentedPicker(
            selection: $window.animation(.snappy(duration: DesignTokens.Animation.fast)),
            title: nil
        ) { option in
            Text(option.label)
        }
        .accessibilityLabel("Période d'activité")
    }

    // MARK: - Row

    /// A stock cell: tap opens the operation, the way the budget's own rows do, and the
    /// trailing swipe carries the same actions in the same order and tints.
    private func row(_ transaction: Transaction) -> some View {
        Button {
            onEdit(transaction)
        } label: {
            HStack(spacing: DesignTokens.Spacing.lg) {
                RowIcon(systemName: transaction.kind.icon, tint: transaction.kind.color)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(transaction.name)
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    let tagNames = TagChips.names(for: transaction.tagIds, namesById: tagNamesById)
                    if !tagNames.isEmpty {
                        TagChips(names: tagNames, presentation: .count)
                    }
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountColumn(transaction)
            }
        }
        .listRowBackground(Color.surfaceContainerLowest)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button {
                onDelete(transaction)
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
            .tint(Color.destructivePrimary)

            Button {
                onEdit(transaction)
            } label: {
                Label("Modifier", systemImage: "pencil")
            }
            .tint(Color.editAction)
        }
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

    // MARK: - Empty window

    /// A bounded row, not a grey sentence on the page: "0 CHF" followed by a floating
    /// line of small print reads like a screen that failed to finish loading.
    private var emptyState: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            RowIcon(systemName: "tray", tint: .textTertiary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(window == .week ? "Rien sur ces 7 jours" : "Rien ce mois-ci")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)

                Text("Tes opérations s'afficheront ici")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer(minLength: DesignTokens.Spacing.none)
        }
        .listRowBackground(Color.surfaceContainerLowest)
        .accessibilityElement(children: .combine)
    }
}
