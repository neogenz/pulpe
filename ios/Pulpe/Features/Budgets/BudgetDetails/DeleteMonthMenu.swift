import SwiftUI

/// The month's "…" menu (V2 `Mois-menu`): go to another month, compare the accounts, show one
/// kind, and "Supprimer ce mois", disabled with its reason unless the month is still to come.
/// Applied to the screen as a modifier so the view stays inside its line budget.
///
/// Deleting: the impact is read when the entry is tapped, not when the screen opens, so the
/// counts and the links sentence are fresh at the moment of confirming. The month id and its
/// name are captured at that same tap and carried to the DELETE: a month switch while the
/// request is on the wire must not retarget the confirmation. The server enforces the "future
/// month only" rule; the menu is a courtesy, not the guard.
struct DeleteMonthMenu: ViewModifier {
    /// What the confirmation alert names and, once confirmed, deletes.
    private struct PendingDeletion {
        let budgetId: String
        let monthLabel: String
        let impact: BudgetDeletionImpact
    }

    let coordinator: BudgetDetailsCoordinator
    let screenState: BudgetDetailsScreenState
    let toastContext: ToastContext
    /// The open month, written back to switch month.
    let monthSelection: Binding<String>
    let typeFilter: Binding<BudgetLineKindFilter>
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var pending: PendingDeletion?

    // MARK: - Rules

    /// True when the month comes after the live period. Not `Date.isFutureMonth`: it reads
    /// the calendar month and ignores the pay day, which moves the live period.
    static func isFutureMonth(month: Int, year: Int, payDayOfMonth: Int?, now: Date = .now) -> Bool {
        BudgetPeriodCalculator.comparePeriods(
            BudgetPeriod(month: month, year: year),
            BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        ) > 0
    }

    /// The month as it reads inside the title sentence: "novembre 2026", "November 2026".
    static func monthLabel(month: Int, year: Int, in language: SupportedLocale = AppLocale.current) -> String {
        "\(Formatters.monthNameInText(for: month, in: language)) \(year)"
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
            labels.append(AppLocale.string("prévision lissée (\(links.spreadForecasts))"))
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
        Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    }

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu(AppLocale.string("Plus d'options"), systemImage: "ellipsis") {
                        menuItems
                    }
                    .pulpeMenuContent()
                    .accessibilityIdentifier("budgetMonthMenu")
                }
            }
            .alert(
                "Supprimer \(pending?.monthLabel ?? "") ?",
                isPresented: isAlertPresented,
                presenting: pending
            ) { deletion in
                Button("Annuler", role: .cancel) {}
                Button("Supprimer", role: .destructive) {
                    Task {
                        await coordinator.dispatch(.deleteMonth(
                            budgetId: deletion.budgetId,
                            confirmLinks: deletion.impact.hasLinks,
                            toastContext,
                            onDeleted: { router.popToRoot() }
                        ))
                    }
                }
            } message: { deletion in
                Text(Self.message(for: deletion.impact))
            }
    }

    @ViewBuilder
    private var menuItems: some View {
        Menu {
            Picker(AppLocale.string("Mois"), selection: monthSelection) {
                // Newest first: the recent months are the target in practice.
                ForEach(coordinator.dataStore.pagerMonths.reversed(), id: \.id) { sparse in
                    Text(BudgetDetailsView.monthMenuLabel(for: sparse)).tag(sparse.id)
                }
            }
        } label: {
            Label(AppLocale.string("Aller à un autre mois"), systemImage: "calendar")
        }

        Button(AppLocale.string("Comparer mes comptes"), systemImage: "building.columns") {
            router.present(.realizedBalance)
        }
        .accessibilityIdentifier("budgetTrackingButton")

        Picker(AppLocale.string("Afficher"), selection: typeFilter) {
            ForEach(Self.kindOrder) { option in
                Text(option == .all ? AppLocale.string("Tout voir") : option.label).tag(option)
            }
        }
        .pickerStyle(.inline)

        Section {
            DeleteMenuButton(
                title: "Supprimer ce mois",
                subtitle: isFutureMonth ? nil : "Seulement un mois à venir"
            ) { loadImpact() }
            .disabled(!isFutureMonth)
        }
    }

    private static let kindOrder: [BudgetLineKindFilter] = [.all, .expense, .income, .saving]

    private func loadImpact() {
        guard let month = screenState.hero.month, let year = screenState.hero.year else { return }
        // Everything the alert needs is read from the same snapshot, before the await.
        let budgetId = screenState.budgetId
        let monthLabel = Self.monthLabel(month: month, year: year)
        Task {
            do {
                let impact = try await coordinator.monthDeletionImpact(budgetId: budgetId)
                pending = PendingDeletion(budgetId: budgetId, monthLabel: monthLabel, impact: impact)
            } catch {
                // A fixed string: the server's own message is English with a UUID, or French
                // whatever the app language.
                toastContext.toastManager.show(AppLocale.string("Le mois n'a pas pu être supprimé"), type: .error)
            }
        }
    }
}
