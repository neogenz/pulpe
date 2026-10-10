import SwiftUI

/// "Rapprocher mes comptes" (PUL-351): the bank balances typed by the user, the month's
/// checked balance, then the gap and its one adjustment. Presented over the home
/// screen's "Suivi du budget" with the month the home screen has loaded — the flow never
/// resolves a month of its own. Every input lives in `flow`, owned here, so closing at
/// any step discards it and writes nothing.
struct ReconcileAccountsSheet: View {
    /// The loaded month as `CurrentMonthStore` holds it, read again on every render.
    struct Month {
        let budgetId: String
        let realizedMetrics: BudgetFormulas.RealizedMetrics
        let rollover: Decimal
        /// "5 mars - 4 avr." when the pay day is not the 1st, `nil` for a calendar month.
        let periodLabel: String?
        /// What is left to check, the same count as the home screen's "À pointer".
        let uncheckedCount: Int
    }

    let month: Month

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var flow: ReconcileAccountsFlow
    @State private var submitSuccessTrigger = false

    init(
        month: Month,
        dependencies: AddTransactionDependencies = .live,
        onAdjustmentCreated: @escaping @MainActor (Transaction) -> Void
    ) {
        self.month = month
        _flow = State(initialValue: ReconcileAccountsFlow(
            budgetId: month.budgetId,
            adjustmentLabel: AppLocale.string("Ajustement"),
            createTransaction: dependencies.createTransaction,
            onAdjustmentCreated: onAdjustmentCreated,
            onCompleted: { completion in
                AnalyticsService.shared.capture(
                    .accountReconciliationCompleted,
                    properties: completion.analyticsProperties
                )
            }
        ))
    }

    var body: some View {
        NavigationStack(path: $flow.path) {
            ReconcileAccountsEntryStep(flow: flow, currency: userSettingsStore.currency) {
                dismiss()
            }
            .navigationDestination(for: ReconcileAccountsFlow.Step.self) { step in
                // A pushed step's own dismiss would only pop it: its X gets the sheet's.
                switch step {
                case .summary:
                    ReconcileSummaryStep(
                        flow: flow,
                        month: month,
                        currency: userSettingsStore.currency,
                        onClose: { dismiss() }
                    )
                case .itemsToCheck:
                    ReconcileItemsToCheckStep(
                        flow: flow,
                        currency: userSettingsStore.currency,
                        onClose: { dismiss() }
                    )
                case .verdict:
                    ReconcileVerdictStep(
                        flow: flow,
                        month: month,
                        currency: userSettingsStore.currency,
                        onSubmit: submitAdjustment,
                        onFinish: finishUpToDate,
                        onClose: { dismiss() }
                    )
                }
            }
        }
        .standardSheetPresentation()
        // Same guard as the hidden back button and the disabled close: nothing leaves
        // the sheet while the write is in flight.
        .interactiveDismissDisabled(flow.isSubmitting)
        .onChange(of: flow.shouldClose(loadedBudgetId: month.budgetId)) { _, shouldClose in
            if shouldClose { dismiss() }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .suppressesTips()
    }

    /// A refusal keeps the step and every input: one toast, then the same button retries.
    private func submitAdjustment() async {
        switch await flow.submitAdjustment(
            realizedBalance: month.realizedMetrics.realizedBalance,
            of: month.budgetId
        ) {
        case .created:
            submitSuccessTrigger.toggle()
            toastManager.show(AppLocale.string("Ajustement enregistré"))
            dismiss()
        case .failed:
            toastManager.show(
                AppLocale.string("L'ajustement n'a pas pu être enregistré — réessaie"),
                type: .error
            )
        case .ignored:
            break
        }
    }

    private func finishUpToDate() {
        let balance = month.realizedMetrics.realizedBalance
        guard flow.confirmUpToDate(realizedBalance: balance, of: month.budgetId) else { return }
        submitSuccessTrigger.toggle()
        dismiss()
    }
}

// MARK: - Step chrome

/// What the steps share: the scrolling body on the sheet surface, the action footer
/// pinned above the keyboard, the inline title and the close button. Back and close are
/// held while the write is in flight. No step adds a keyboard toolbar: on iOS 26 it
/// floats outside the keyboard's safe area, over the footer.
private struct ReconcileStepChrome<Footer: View>: ViewModifier {
    let title: String
    let isSubmitting: Bool
    /// The sheet's dismissal: inside a pushed step, the environment's would pop the step.
    let onClose: @MainActor () -> Void
    @ViewBuilder let footer: () -> Footer

    func body(content: Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                content
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xl)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .background(Color.sheetBackground)
        .dismissKeyboardOnTap()
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: DesignTokens.Spacing.md) {
                footer()
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(Color.sheetBackground)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(isSubmitting)
        .toolbar {
            // Trailing, so the back chevron keeps the leading edge on every step.
            ToolbarItem(placement: .topBarTrailing) {
                SheetCloseButton(action: onClose)
                    .disabled(isSubmitting)
            }
        }
    }
}

extension View {
    func reconcileStep<Footer: View>(
        _ title: String,
        isSubmitting: Bool = false,
        onClose: @escaping @MainActor () -> Void,
        @ViewBuilder footer: @escaping () -> Footer
    ) -> some View {
        modifier(ReconcileStepChrome(title: title, isSubmitting: isSubmitting, onClose: onClose, footer: footer))
    }
}

// MARK: - Previews

#Preview("Comptes") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            ReconcileAccountsSheet(
                month: .init(
                    budgetId: "preview",
                    realizedMetrics: .init(
                        realizedIncome: 5200,
                        realizedExpenses: 2100.35,
                        realizedBalance: 3219.65,
                        checkedItemsCount: 12,
                        totalItemsCount: 18,
                        checkedSavingsAmount: 300
                    ),
                    rollover: 120,
                    periodLabel: "25 févr. - 24 mars",
                    uncheckedCount: 6
                ),
                onAdjustmentCreated: { _ in }
            )
            .environment(CurrentMonthStore())
            .environment(ToastManager())
            .environment(UserSettingsStore())
        }
}
