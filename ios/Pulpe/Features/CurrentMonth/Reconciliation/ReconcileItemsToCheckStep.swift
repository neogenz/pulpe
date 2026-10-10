import SwiftUI

/// Pushed from "Ton solde pointé": what the month still has to check, pointed right here,
/// so the accounts typed before stay in the flow and the checked balance moves under them.
struct ReconcileItemsToCheckStep: View {
    let flow: ReconcileAccountsFlow
    let currency: SupportedCurrency
    let onClose: @MainActor () -> Void

    @Environment(CurrentMonthStore.self) private var store
    @Environment(ToastManager.self) private var toastManager
    /// Taken at the first appearance: pointing an item takes it out of the store's
    /// unchecked list, and its row would vanish under the finger. Kept, a row pointed by
    /// mistake is unpointed with the same disc.
    @State private var listedItems: [CurrentMonthStore.CheckableItem]?
    /// Discs still playing their fill: the toggle only starts once it ends.
    @State private var completingItemIds: Set<String> = []

    /// Leaving mid-pointing would compare against a balance that is still moving.
    private var isPointingSettled: Bool {
        completingItemIds.isEmpty && !store.hasTogglesInFlight
    }

    var body: some View {
        let items = (listedItems ?? store.allUncheckedItems).compactMap(liveItem)
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Pointe ce qui est déjà passé sur tes comptes : ton solde pointé suit.")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if !items.isEmpty {
                FormCard {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 {
                            FormRowDivider()
                        }
                        itemRow(item)
                    }
                }
            }
        }
        .reconcileStep(AppLocale.string("Opérations à pointer"), onClose: onClose) {
            Button("Comparer avec mes comptes") { flow.continueToVerdict() }
                .disabled(!isPointingSettled)
                .primaryButtonStyle(isEnabled: isPointingSettled)
                .accessibilityIdentifier("reconcileCompareButton")
        }
        .onAppear {
            if listedItems == nil { listedItems = store.allUncheckedItems }
        }
    }

    private func itemRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            PointCircle(
                kind: item.kind,
                isPointed: isChecked(item),
                color: item.kind.color,
                isSyncing: isSyncing(item),
                onCompletionStateChange: { isCompleting in
                    if isCompleting {
                        completingItemIds.insert(item.id)
                    } else {
                        completingItemIds.remove(item.id)
                    }
                },
                onToggle: { toggle(item) }
            )
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(item.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
                Text(UncheckedOperationsCard.subtitle(for: item))
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
            }
            .accessibilityElement(children: .combine)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(UncheckedOperationsCard.amountText(for: item, in: currency))
                .font(PulpeTypography.amountMedium)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.sm)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .accessibilityIdentifier("reconcileItemToCheckRow")
    }

    /// The listed item with the store's current value: the toggle reads the state it flips
    /// from what it is handed. A deleted item drops out of the list.
    private func liveItem(_ item: CurrentMonthStore.CheckableItem) -> CurrentMonthStore.CheckableItem? {
        switch item {
        case .transaction(let transaction, let consumption):
            store.transactions.first { $0.id == transaction.id }.map { .transaction($0, consumption: consumption) }
        case .budgetLine(let line, let consumption):
            store.budgetLines.first { $0.id == line.id }.map { .budgetLine($0, consumption: consumption) }
        }
    }

    private func isChecked(_ item: CurrentMonthStore.CheckableItem) -> Bool {
        switch item {
        case .transaction(let transaction, _): transaction.isChecked
        case .budgetLine(let line, _): line.isChecked
        }
    }

    private func isSyncing(_ item: CurrentMonthStore.CheckableItem) -> Bool {
        switch item {
        case .transaction(let transaction, _): store.syncingTransactionIds.contains(transaction.id)
        case .budgetLine(let line, _): store.syncingBudgetLineIds.contains(line.id)
        }
    }

    private func toggle(_ item: CurrentMonthStore.CheckableItem) {
        let wasChecked = isChecked(item)
        Task {
            let didSucceed: Bool
            switch item {
            case .transaction(let transaction, _):
                didSucceed = await store.toggleTransaction(transaction)
            case .budgetLine(let line, _):
                didSucceed = await store.toggleBudgetLine(line)
            }
            // ponytail: a refused unpoint only shows as the disc filling back; it gets its
            // own message the day it is more than a rare network refusal.
            guard !didSucceed, !wasChecked else { return }
            toastManager.show(
                AppLocale.string("\(item.name) n'a pas pu être pointé — réessaie"),
                type: .error
            )
        }
    }
}
