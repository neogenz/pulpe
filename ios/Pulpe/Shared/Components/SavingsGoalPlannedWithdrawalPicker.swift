import SwiftUI

/// Which goal an income FORECAST announces a withdrawal from (PUL-329 v2).
///
/// Presented by `SavingsGoalPickerField` in `.plannedWithdrawal` mode; split into
/// its own file because that one is already at its length budget.
///
/// Deliberately different from the real-withdrawal picker next door:
/// - every goal is listed, whatever it holds today. Announcing a retrait takes
///   nothing out of the pot, and money can still arrive before the month named.
/// - the preview reads the **projection of the budget's own month**, not the
///   current balance — a retrait planned for August is judged on August.
/// - an insufficient projection warns and lets the user carry on. Only the real
///   withdrawal blocks, and only against a balance the server confirms.
struct SavingsGoalPlannedWithdrawalPicker: View {
    @Binding var selection: String?
    /// Already converted into the account currency (RG-009), like the real
    /// withdrawal picker: comparing the typed amount would weigh a foreign figure
    /// against a balance held in another currency.
    let withdrawalAmount: Decimal?
    /// The budget the forecast lands in — the month the projection is read at.
    let budgetPeriod: BudgetPeriod?
    let onReadinessChange: (Bool) -> Void

    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var progress: SavingsGoalProgress?
    @State private var isLoadingProgress = false

    /// What the pot is expected to hold at `budgetPeriod`, and what the
    /// announcement would leave. Kept a value so the arithmetic can be reasoned
    /// about — and tested — without a view.
    struct Projection: Equatable {
        let before: Decimal
        /// `nil` while the typed amount has no rate yet — showing `before → before`
        /// would announce a retrait of zero. The projection is an aid, so a missing
        /// rate hides the "après" instead of blocking anything.
        let after: Decimal?

        /// Same cent-level decision as the server: a sub-cent residue is zero.
        var isOverProjection: Bool {
            guard let after else { return false }
            return after < 0
        }
    }

    /// The last month at or before `period` that carries a projection, falling
    /// back to the confirmed balance when the plan has no such row — an undated
    /// goal, or a budget opened before the plan window starts.
    static func projection(
        from progress: SavingsGoalProgress,
        at period: BudgetPeriod?,
        withdrawing amount: Decimal?
    ) -> Projection {
        let upToPeriod = period.map { period in
            progress.months.filter { month in
                BudgetPeriodCalculator.comparePeriods(month.period, period) <= 0
                    && month.projectedCumulative != nil
            }
        } ?? []
        let before = (upToPeriod.last?.projectedCumulative ?? progress.confirmed).rounded(2)
        return Projection(
            before: before,
            after: amount.map { (before - $0.rounded(2)).rounded(2) }
        )
    }

    private var projection: Projection? {
        progress.map { Self.projection(from: $0, at: budgetPeriod, withdrawing: withdrawalAmount) }
    }

    private var selectedGoal: SavingsGoal? {
        guard let selection else { return nil }
        return store.goals.first { $0.id == selection }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            content
            note
        }
        .task(id: selection) { await loadProgress() }
        // Readiness stops at « un objectif est choisi »: the amount is a forecast,
        // so neither a pending projection nor an over-projection blocks the submit.
        .onChange(of: selection, initial: true) { _, newSelection in
            onReadinessChange(newSelection != nil)
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.hasError {
            savingsGoalFieldError { Task { await store.forceRefresh() } }
        } else if !store.hasLoadedOnce {
            savingsGoalFieldLoading()
        } else if store.goals.isEmpty {
            savingsGoalFieldSurface {
                Text("Aucun objectif disponible")
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .accessibilityLabel("Aucun objectif d'épargne disponible")
        } else {
            menuContent
            preview
        }
    }

    private var menuContent: some View {
        Menu {
            ForEach(store.goals) { goal in
                savingsGoalPickerButton(title: goal.name, isSelected: goal.id == selection) {
                    selection = goal.id
                }
            }
        } label: {
            savingsGoalFieldSurface {
                Text(selectedGoal?.name ?? AppLocale.string("Choisis un objectif"))
                    .foregroundStyle(selectedGoal == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif utilisé")
        .accessibilityValue(selectedGoal?.name ?? AppLocale.string("Aucun objectif choisi"))
    }

    @ViewBuilder
    private var preview: some View {
        if selection != nil {
            if let projection {
                let currency = userSettingsStore.currency
                let after = projection.after.map { " → \($0.asAdaptiveCurrency(currency))" } ?? ""
                Text("Projection du mois · \(projection.before.asAdaptiveCurrency(currency))\(after)")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .sensitiveAmount()

                if projection.isOverProjection {
                    Text("""
                        Ce montant dépasse ce que l'objectif devrait contenir ce mois-là. \
                        Tu peux quand même le planifier.
                        """)
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
                }
            } else if isLoadingProgress {
                Text("Chargement de la projection…")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
    }

    /// States the whole point of the mode: nothing has left the pot yet. Always
    /// visible, including before a goal is picked — it is what tells the user
    /// this is an announcement rather than a transfer.
    private var note: some View {
        Text("Le retrait reste prévu. Le solde baisse quand tu crées le revenu réel.")
            .font(PulpeTypography.footnote)
            .foregroundStyle(Color.onSurfaceVariant)
    }

    /// A failed projection leaves the picker usable: it is an aid, not a gate.
    /// Task cancellation on a fast re-selection is normal and keeps the previous
    /// figures on screen until the new ones land.
    private func loadProgress() async {
        guard let selection else {
            progress = nil
            return
        }
        isLoadingProgress = true
        defer { isLoadingProgress = false }
        progress = try? await store.getProgress(id: selection)
    }
}
