import SwiftUI

// MARK: - Movement lists

/// The two movement lists under the envelope sections, split out to keep the main
/// view file under the feature's 350-LOC budget (same precedent as `+Routing`).
extension BudgetDetailsView {
    @ViewBuilder
    var movementLists: some View {
        let screenState = projector.screenState

        if !screenState.free.isEmpty {
            BudgetDetailsFreeTransactionsList(
                subtitle: AppLocale.string("Sans prévision, ils sortent de ton disponible"),
                total: screenState.free
                    .reduce(Decimal(0)) { sum, item in
                        sum + (item.transaction.kind.isOutflow ? item.transaction.amount : -item.transaction.amount)
                    }
                    .asAmount(for: userSettingsStore.currency),
                items: screenState.free,
                currency: userSettingsStore.currency,
                tagNamesById: tagStore.namesById,
                onTap: { transaction in
                    router.present(.movement(lineId: nil, transactionId: transaction.id))
                },
                onTogglePointed: toggleTransaction
            )
        }
    }

    private func toggleTransaction(_ transaction: Transaction) {
        Task { await coordinator.dispatch(.toggleTransaction(transaction)) }
    }
}
