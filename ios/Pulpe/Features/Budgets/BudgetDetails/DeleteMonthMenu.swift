import SwiftUI

/// "Supprimer ce mois" on a future month (PUL-361): a toolbar menu with one destructive
/// entry, then an alert that states what goes away. Applied to the screen as a modifier so
/// the view stays inside its line budget, like `PlannedWithdrawalUndoAlert`.
///
/// The impact is read when the entry is tapped, not when the screen opens, so the counts
/// and the links sentence are fresh at the moment of confirming. The server enforces the
/// "future month only" rule; the menu is a courtesy, not the guard.
struct DeleteMonthMenu: ViewModifier {
    let coordinator: BudgetDetailsCoordinator
    let screenState: BudgetDetailsScreenState
    let toastContext: ToastContext
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var impact: BudgetDeletionImpact?

    // MARK: - Rules

    /// True when the month comes after the live period. Not `Date.isFutureMonth`: it reads
    /// the calendar month and ignores the pay day, which moves the live period.
    static func isFutureMonth(month: Int, year: Int, payDayOfMonth: Int?, now: Date = .now) -> Bool {
        BudgetPeriodCalculator.comparePeriods(
            BudgetPeriod(month: month, year: year),
            BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        ) > 0
    }

    /// The counts sentence, plus the links sentence when the month is tied to others. A
    /// forecast is counted in one link category only, and the withdrawal label adds its
    /// forecasts and its movements together.
    static func message(for impact: BudgetDeletionImpact) -> String {
        let forecasts = impact.forecastCount
        let movements = impact.movementCount
        let counts = AppLocale.string("""
            Ses prévisions (\(forecasts)) et ses mouvements (\(movements)) seront supprimés. \
            Cette action est irréversible.
            """)
        guard impact.hasLinks else { return counts }

        let links = impact.links
        let withdrawals = links.savingsWithdrawalForecasts + links.savingsWithdrawalMovements
        var labels: [String] = []
        if links.spreadForecasts > 0 {
            labels.append(AppLocale.string("dépense lissée (\(links.spreadForecasts))"))
        }
        if links.savingsGoalForecasts > 0 {
            labels.append(AppLocale.string("objectif d'épargne (\(links.savingsGoalForecasts))"))
        }
        if withdrawals > 0 {
            labels.append(AppLocale.string("retrait d'épargne (\(withdrawals))"))
        }
        let list = labels.joined(separator: ", ")
        let linked = AppLocale.string("""
            Ce mois est aussi lié à d'autres mois ou à un objectif d'épargne : \(list). \
            Les autres mois gardent leur part.
            """)
        return "\(counts)\n\(linked)"
    }

    // MARK: - Body

    private var isFutureMonth: Bool {
        guard let month = screenState.hero.month, let year = screenState.hero.year else { return false }
        return Self.isFutureMonth(month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth)
    }

    private var isAlertPresented: Binding<Bool> {
        Binding(get: { impact != nil }, set: { if !$0 { impact = nil } })
    }

    func body(content: Content) -> some View {
        content
            .toolbar {
                if isFutureMonth {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            DeleteMenuButton(title: "Supprimer ce mois") { loadImpact() }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .pulpeMenuContent()
                        .accessibilityLabel(AppLocale.string("Plus d'options"))
                    }
                }
            }
            .alert(
                "Supprimer \(screenState.monthYear) ?",
                isPresented: isAlertPresented,
                presenting: impact
            ) { impact in
                Button("Annuler", role: .cancel) {}
                Button("Supprimer", role: .destructive) {
                    Task {
                        await coordinator.dispatch(.deleteMonth(
                            confirmLinks: impact.hasLinks,
                            toastContext,
                            onDeleted: { router.popToRoot() }
                        ))
                    }
                }
            } message: { impact in
                Text(Self.message(for: impact))
            }
    }

    private func loadImpact() {
        Task {
            do {
                impact = try await coordinator.monthDeletionImpact()
            } catch {
                toastContext.toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            }
        }
    }
}
