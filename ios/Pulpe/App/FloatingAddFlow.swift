import SwiftUI

extension View {
    /// The global "+" of the root screens and the two sheets it leads to: Nouvelle dépense,
    /// then Nouvelle prévision when the user picks « Réserver un montant pour plus tard ».
    func floatingAddFlow(isVisible: Bool) -> some View {
        modifier(FloatingAddFlow(isVisible: isVisible))
    }
}

private struct FloatingAddFlow: ViewModifier {
    let isVisible: Bool

    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var isAddSheetPresented = false
    /// « Réserver un montant pour plus tard »: set by the movement sheet, honoured once it is gone.
    @State private var wantsNewForecast = false
    @State private var isForecastSheetPresented = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottomTrailing) {
                if isVisible {
                    FloatingAddButton { isAddSheetPresented = true }
                        .padding(.trailing, DesignTokens.Control.fabTrailingInset)
                        .padding(.bottom, DesignTokens.Control.fabBottomInset)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(.snappy, value: isVisible)
            .sheet(isPresented: $isAddSheetPresented, onDismiss: openForecastIfAsked) {
                if let budget = currentMonthStore.budget {
                    MovementSheet(
                        context: context(budgetId: budget.id),
                        userCurrency: userSettingsStore.currency,
                        onRequestNewForecast: { wantsNewForecast = true },
                        onAdd: currentMonthStore.addTransaction
                    )
                }
            }
            .sheet(isPresented: $isForecastSheetPresented) {
                if let budget = currentMonthStore.budget {
                    AddBudgetLineSheet(
                        budgetId: budget.id,
                        anchorMonth: budget.month,
                        anchorYear: budget.year,
                        templateId: budget.templateId,
                        initialKind: .expense,
                        ledger: context(budgetId: budget.id).ledger,
                        onTemplateLineAdded: refreshMonth,
                        onAdd: { _ in refreshMonth() }
                    )
                }
            }
    }

    private func context(budgetId: String) -> MovementSheetContext {
        MovementSheetContext(store: currentMonthStore, budgetId: budgetId, source: .addButton)
    }

    private func openForecastIfAsked() {
        guard wantsNewForecast else { return }
        wantsNewForecast = false
        isForecastSheetPresented = true
    }

    private func refreshMonth() {
        currentMonthStore.invalidateCache()
        Task { await currentMonthStore.forceRefresh() }
    }
}
