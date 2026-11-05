import SwiftUI

/// Every movement of the month, grouped by day (V2 `Mouvements`): pushed from « Tout voir »,
/// searchable, filtered by chips. The circle points, a tap opens « Modifier ».
struct MovementsPage: View {
    @Environment(CurrentMonthStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.requestEditMovement) private var requestEditMovement
    @State private var filter: MovementsFilter = .all
    @State private var query = ""

    private var lineNames: [String: String] {
        Dictionary(uniqueKeysWithValues: store.budgetLines.map { ($0.id, $0.name) })
    }

    private var monthName: String {
        store.budget.map { Formatters.monthName(for: $0.month) } ?? ""
    }

    var body: some View {
        let shown = MovementsFilter.apply(filter, query: query, to: store.transactions, lineNames: lineNames)
        let groups = MovementDayGroup.groups(of: shown)

        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                PageHeader(
                    title: AppLocale.string("Mouvements"),
                    subtitle: AppLocale.string("\(monthName) · \(store.transactions.count) mouvements")
                )
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    PulpeSearchField(prompt: "Rechercher un mouvement", text: $query)
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                    chips
                }
                if groups.isEmpty {
                    emptyBlock
                } else {
                    ForEach(groups) { group in dayGroup(group) }
                }
            }
            .padding(.top, DesignTokens.Spacing.sm)
            .animation(DesignTokens.Animation.smoothEaseOut, value: filter)
        }
        .scrollDismissesKeyboard(.interactively)
        .pulpeRootBottomInset()
        .background { Color.appBackground.ignoresSafeArea() }
        .navigationTitle(Tab.currentMonth.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .trackScreen("Movements")
    }

    // MARK: - Chips

    private var chips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                ForEach(MovementsFilter.allCases, id: \.self) { option in
                    Button { filter = option } label: {
                        PulpeChip(
                            label: label(for: option),
                            count: option == .all ? nil : option.count(in: store.transactions),
                            style: filter == option ? .selected : .outlined
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(filter == option ? .isSelected : [])
                    .accessibilityIdentifier("movementsFilter-\(option)")
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
    }

    private func label(for option: MovementsFilter) -> String {
        switch option {
        case .all: AppLocale.string("Tout")
        case .unpointed: AppLocale.string("À pointer")
        case .unplanned: PendingWording.unplanned
        }
    }

    // MARK: - Days

    private func dayGroup(_ group: MovementDayGroup) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(group.fullLabel)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)

            MovementCard {
                ForEach(Array(group.transactions.enumerated()), id: \.element.id) { index, transaction in
                    if index > 0 {
                        Divider().overlay(Color.outlineVariant).padding(.leading, DesignTokens.ListRow.dividerInset)
                    }
                    MovementRow(
                        transaction: transaction,
                        lineName: transaction.budgetLineId.flatMap { lineNames[$0] },
                        currency: userSettingsStore.currency,
                        isSyncing: store.syncingTransactionIds.contains(transaction.id),
                        showsChevron: true,
                        onToggle: { toggle(transaction) },
                        onOpen: { edit(transaction) }
                    )
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    private var emptyBlock: some View {
        Text(query.isEmpty ? "Rien à afficher ici." : "Aucun mouvement ne correspond.")
            .font(PulpeTypography.bodyLarge)
            .foregroundStyle(Color.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(DesignTokens.Spacing.xxl)
            .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.surface))
            .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Actions

    private func toggle(_ transaction: Transaction) {
        Task { await store.togglePointing(of: transaction, toasts: toastManager) }
    }

    private func edit(_ transaction: Transaction) {
        guard let budgetId = store.budget?.id else { return }
        requestEditMovement?(budgetId, transaction.id)
    }
}
