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
    /// What the confirmation names and, once confirmed, deletes.
    private struct PendingDeletion {
        let budgetId: String
        let month: Int
        let monthLabel: String
        let impact: BudgetDeletionImpact
        /// The month's prévisions at the tap, to name what the links lose.
        let lines: [BudgetLine]
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

    /// What leaves with the month (V2 `Mois-supprimer`): the counts, then, for a linked month,
    /// what each linked prévision loses, named from the month's own lines. The server counts
    /// stay the truth for whether a link exists; the names only make it concrete.
    static func message(
        for impact: BudgetDeletionImpact,
        lines: [BudgetLine],
        currency: SupportedCurrency
    ) -> String {
        let forecasts = AppLocale.string("Ses \(impact.forecastCount) prévisions partent avec lui.")
        let movements = impact.movementCount == 0
            ? AppLocale.string("Il n'a encore aucun mouvement.")
            : AppLocale.string("Ses \(impact.movementCount) mouvements partent aussi.")
        let counts = "\(forecasts) \(movements)"
        guard impact.hasLinks else { return counts }

        let losses = lines.compactMap { line -> String? in
            let amount = line.amount.asAmount(for: currency)
            if line.spreadGroupId != nil {
                return AppLocale.string("\(line.name) y perd sa part lissée (\(amount))")
            }
            if line.savingsGoalId != nil || line.savingsWithdrawalGroupId != nil {
                return AppLocale.string("\(line.name) y perd ses \(amount)")
            }
            return nil
        }
        let links = losses.isEmpty
            ? AppLocale.string("Il est lié à d'autres mois. Les autres mois ne changent pas.")
            : AppLocale.string(
                "Il est lié à d'autres mois : \(losses.joined(separator: ", ")). Les autres mois ne changent pas."
            )
        return "\(counts)\n\(links)"
    }

    /// « Ton disponible de novembre ne change pas. C'est définitif. »: the live month, which a
    /// month still to come never feeds.
    static func finality(payDayOfMonth: Int?, now: Date = .now) -> String {
        let live = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth).month
        let name = Formatters.monthNameInText(for: live)
        return ReportWording.elides(name)
            ? AppLocale.string("Ton disponible d'\(name) ne change pas. C'est définitif.")
            : AppLocale.string("Ton disponible de \(name) ne change pas. C'est définitif.")
    }

    // MARK: - Body

    private var isFutureMonth: Bool {
        guard let month = screenState.hero.month, let year = screenState.hero.year else { return false }
        return Self.isFutureMonth(month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth)
    }

    private var isConfirmationPresented: Binding<Bool> {
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
            .sheet(isPresented: isConfirmationPresented) {
                if let deletion = pending {
                    confirmation(for: deletion)
                }
            }
    }

    private func confirmation(for deletion: PendingDeletion) -> some View {
        let currency = userSettingsStore.currency
        return ImpactConfirmSheet(
            title: AppLocale.string("Supprimer \(deletion.monthLabel) ?"),
            message: Self.message(for: deletion.impact, lines: deletion.lines, currency: currency),
            note: Self.finality(payDayOfMonth: userSettingsStore.payDayOfMonth),
            currency: currency,
            isDestructive: true,
            primary: .init(
                title: AppLocale.string("Supprimer \(Formatters.monthNameInText(for: deletion.month))"),
                accessibilityIdentifier: "deleteMonthConfirmButton"
            ) {
                Task {
                    await coordinator.dispatch(.deleteMonth(
                        budgetId: deletion.budgetId,
                        confirmLinks: deletion.impact.hasLinks,
                        toastContext,
                        onDeleted: { router.popToRoot() }
                    ))
                }
            }
        )
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
        // Everything the confirmation needs is read from the same snapshot, before the await.
        let budgetId = screenState.budgetId
        let monthLabel = Self.monthLabel(month: month, year: year)
        let lines = coordinator.dataStore.budgetLines
        Task {
            do {
                let impact = try await coordinator.monthDeletionImpact(budgetId: budgetId)
                pending = PendingDeletion(
                    budgetId: budgetId, month: month, monthLabel: monthLabel, impact: impact, lines: lines
                )
            } catch {
                // A fixed string: the server's own message is English with a UUID, or French
                // whatever the app language.
                toastContext.toastManager.show(AppLocale.string("Le mois n'a pas pu être supprimé"), type: .error)
            }
        }
    }
}
