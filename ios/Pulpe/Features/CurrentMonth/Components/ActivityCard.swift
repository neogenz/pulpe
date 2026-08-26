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
        let windowed = filtered
        let groups = dayGroups(for: windowed)

        activityHeader(for: windowed)

        if groups.isEmpty {
            emptyState
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.lg)
                .contentListRow()
        } else {
            ForEach(groups) { group in
                daySection(group)
            }
        }
    }

    private func activityHeader(for windowed: [Transaction]) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(
                title: AppLocale.string("Activité"),
                amountSubtitle: headerTotal(for: windowed),
                link: (label: AppLocale.string("Tout voir"), action: onViewAll)
            )

            windowPicker
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.xxl)
        .contentListRow()
        .animation(DesignTokens.Animation.smoothEaseOut, value: window)
        .accessibilityIdentifier("homeActivityCard")
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

    // MARK: - Day group

    private func daySection(_ group: DayGroup) -> some View {
        Section {
            ForEach(Array(group.transactions.enumerated()), id: \.element.id) { index, transaction in
                row(transaction)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .overlay(alignment: .bottom) {
                        if index < group.transactions.count - 1 {
                            Divider()
                        }
                    }
                    .listRowInsets(EdgeInsets(
                        top: DesignTokens.Spacing.none,
                        leading: DesignTokens.Spacing.xxl,
                        bottom: DesignTokens.Spacing.none,
                        trailing: DesignTokens.Spacing.xxl
                    ))
                    .listRowBackground(rowBackground(index: index, count: group.transactions.count))
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) { onDelete(transaction) } label: {
                            Label(AppLocale.string("Supprimer"), systemImage: "trash")
                        }
                        .tint(Color.destructivePrimary)
                        .accessibilityIdentifier("homeActivityDelete-\(transaction.id)")

                        Button { onEdit(transaction) } label: {
                            Label(AppLocale.string("Modifier"), systemImage: "pencil")
                        }
                        .tint(Color.editAction)
                        .accessibilityIdentifier("homeActivityEdit-\(transaction.id)")
                    }
                    .accessibilityIdentifier("homeActivityRow-\(transaction.id)")
            }
        } header: {
            Text(group.label)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appBackground)
                .accessibilityAddTraits(.isHeader)
        }
        .textCase(nil)
        .listSectionSeparator(.hidden)
    }

    private func row(_ transaction: Transaction) -> some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            RowIcon(systemName: transaction.kind.icon, tint: transaction.kind.color)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                // No date under the name any more: the day is named once, above the card
                // these rows sit in. `followsText` goes with it — nothing precedes the
                // chips on this line for them to trail.
                let tagNames = TagChips.names(for: transaction.tagIds, namesById: tagNamesById)
                if !tagNames.isEmpty {
                    TagChips(names: tagNames, presentation: .count)
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            amountColumn(transaction)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
    }

    private func rowBackground(index: Int, count: Int) -> some View {
        let topRadius = index == 0 ? DesignTokens.CornerRadius.card : DesignTokens.Spacing.none
        let bottomRadius = index == count - 1 ? DesignTokens.CornerRadius.card : DesignTokens.Spacing.none
        return UnevenRoundedRectangle(
            topLeadingRadius: topRadius,
            bottomLeadingRadius: bottomRadius,
            bottomTrailingRadius: bottomRadius,
            topTrailingRadius: topRadius,
            style: .continuous
        )
        .fill(Color.surfaceContainerLowest)
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
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeRowCard()
        .accessibilityElement(children: .combine)
    }
}

extension View {
    func activityDeletionConfirmation(
        pending: Binding<Transaction?>,
        onConfirm: @escaping (Transaction) -> Void
    ) -> some View {
        alert(
            AppLocale.string("Supprimer « \(pending.wrappedValue?.name ?? "") » ?"),
            isPresented: Binding(
                get: { pending.wrappedValue != nil },
                set: { if !$0 { pending.wrappedValue = nil } }
            ),
            presenting: pending.wrappedValue
        ) { transaction in
            Button(AppLocale.string("Annuler"), role: .cancel) {}
                .accessibilityIdentifier("homeActivityCancelDelete")
            Button(AppLocale.string("Supprimer"), role: .destructive) {
                pending.wrappedValue = nil
                onConfirm(transaction)
            }
            .accessibilityIdentifier("homeActivityConfirmDelete")
        } message: { _ in
            Text(AppLocale.string("Cette action est irréversible."))
        }
    }
}
