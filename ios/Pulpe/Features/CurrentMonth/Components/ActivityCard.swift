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
    /// The one row whose swipe actions are revealed, shared across the day cards.
    @State private var openRowId: AnyHashable?
    @State private var pendingDeletion: Transaction?

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

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(
                title: AppLocale.string("Activité"),
                amountSubtitle: headerTotal(for: windowed),
                link: (label: AppLocale.string("Tout voir"), action: onViewAll)
            )

            // Its own row, full width. Squeezed into the heading it fought the title for
            // the line and had to be re-stacked by hand past `xxLarge`; on a row of its
            // own it fits at every text size, and the labels get their whole word back.
            windowPicker

            if groups.isEmpty {
                emptyState
            } else {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    ForEach(groups) { group in
                        dayGroup(group)
                    }
                }
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: window)
        .accessibilityIdentifier("homeActivityCard")
        .confirmationDialog(
            AppLocale.string("Supprimer cette opération ?"),
            isPresented: Binding(get: { pendingDeletion != nil }, set: { if !$0 { pendingDeletion = nil } }),
            titleVisibility: .visible,
            presenting: pendingDeletion
        ) { transaction in
            Button(AppLocale.string("Supprimer"), role: .destructive) { onDelete(transaction) }
            Button(AppLocale.string("Annuler"), role: .cancel) {}
        } message: { transaction in
            Text(transaction.name)
        }
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

    private func dayGroup(_ group: DayGroup) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // The day sits outside the card, said once, instead of repeating under every
            // name inside it. It carries the header trait so VoiceOver can jump by day —
            // which is the navigation the rows lost when they gave up their date.
            Text(group.label)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .accessibilityAddTraits(.isHeader)

            // Every inset lives on the rows, none on the stack, so a swiped row's buttons
            // run to the card's edge on all four sides the way an inset-grouped `List`
            // section's do — clipped by the card's corner radius and nothing else. A
            // vertical inset here would leave them floating short of the top and bottom
            // edges, which on a one-row day reads as a pill dropped on the card.
            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(Array(group.transactions.enumerated()), id: \.element.id) { index, transaction in
                    if index > 0 { Divider().padding(.horizontal, DesignTokens.Spacing.lg) }
                    row(transaction)
                        .padding(.horizontal, DesignTokens.Spacing.lg)
                        .trailingSwipeActions(id: transaction.id, openId: $openRowId) {
                            swipeButton(systemImage: "pencil", fill: .editAction) { onEdit(transaction) }
                            swipeButton(systemImage: "trash", fill: .destructivePrimary) {
                                pendingDeletion = transaction
                            }
                        }
                        .accessibilityAction(named: AppLocale.string("Modifier")) { onEdit(transaction) }
                        .accessibilityAction(named: AppLocale.string("Supprimer")) { pendingDeletion = transaction }
                }
            }
            .pulpeRowCard()
        }
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

    /// One revealed action: a full-height tinted column with its glyph. Tapping it closes
    /// the row before acting, so the row is at rest whatever the action does next.
    ///
    /// A tinted column and a tap, not a `Button`: on iOS 26 a `Button` insets and rounds its
    /// own chrome even under `.buttonStyle(.plain)`, which drew the pair as two floating
    /// squircles with the row showing through between them instead of one strip. Nothing is
    /// lost by dropping it — the strip is `.accessibilityHidden`, so VoiceOver reaches these
    /// actions through the row's `.accessibilityAction`s and never through this view.
    private func swipeButton(
        systemImage: String,
        fill: Color,
        action: @escaping () -> Void
    ) -> some View {
        fill
            .frame(width: DesignTokens.TapTarget.minimum + DesignTokens.Spacing.lg)
            .frame(maxHeight: .infinity)
            .overlay {
                Image(systemName: systemImage)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textOnPrimary)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                openRowId = nil
                action()
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
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeRowCard()
        .accessibilityElement(children: .combine)
    }
}
