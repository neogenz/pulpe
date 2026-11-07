import SwiftUI

/// « Derniers mouvements » (V2): the latest few, grouped by day, each with its pointing
/// circle. « Tout voir » opens the whole month. Nothing here swipes or deletes: a tap opens
/// the movement's « Modifier » sheet, where both live.
struct RecentMovementsSection: View {
    let transactions: [Transaction]
    let budgetLines: [BudgetLine]
    let syncingTransactionIds: Set<String>
    let onToggle: (Transaction) -> Void
    let onEdit: (Transaction) -> Void
    let onViewAll: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// What the home keeps of the month: enough to see the last two days, not a ledger.
    static let maxRows = 5

    static func visible(_ transactions: [Transaction]) -> [Transaction] {
        Array(transactions.sorted { $0.transactionDate > $1.transactionDate }.prefix(maxRows))
    }

    var body: some View {
        let groups = MovementDayGroup.groups(of: Self.visible(transactions))
        let lineNames = Dictionary(uniqueKeysWithValues: budgetLines.map { ($0.id, $0.name) })

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(
                title: AppLocale.string("Derniers mouvements"),
                link: transactions.isEmpty ? nil : (label: AppLocale.string("Tout voir"), action: onViewAll),
                linkAccessibilityIdentifier: "homeActivityViewAll"
            )
            .padding(.horizontal, DesignTokens.Spacing.xs)

            if groups.isEmpty {
                emptyBlock
            }

            ForEach(groups) { group in
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    // The day is said once above its card; a header trait lets VoiceOver jump by day.
                    Text(group.shortLabel)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textSecondary)
                        .padding(.horizontal, DesignTokens.Spacing.xs)
                        .accessibilityAddTraits(.isHeader)

                    MovementCard {
                        ForEach(Array(group.transactions.enumerated()), id: \.element.id) { index, transaction in
                            if index > 0 {
                                Divider()
                                    .overlay(Color.outlineVariant)
                                    .padding(.leading, DesignTokens.ListRow.dividerInset)
                            }
                            MovementRow(
                                transaction: transaction,
                                lineName: transaction.budgetLineId.flatMap { lineNames[$0] },
                                currency: userSettingsStore.currency,
                                isSyncing: syncingTransactionIds.contains(transaction.id),
                                onToggle: { onToggle(transaction) },
                                onOpen: { onEdit(transaction) }
                            )
                        }
                    }
                }
            }
        }
        // `.contain` first: a bare identifier on the container overwrites every row's own.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeActivityCard")
    }

    /// A flat grey block, not a card: nothing here can be tapped yet, and the sentence says where
    /// the first movement comes from.
    private var emptyBlock: some View {
        Text("Tes mouvements s'afficheront ici.\nLe bouton + sert à les ajouter.")
            .font(PulpeTypography.bodyLarge)
            .foregroundStyle(Color.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(DesignTokens.Spacing.xxl)
            .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.surface))
            .accessibilityIdentifier("homeActivityEmpty")
    }
}
