import SwiftUI

/// Form field that tags a saving prévision to a savings goal (PUL-12).
///
/// Reused by the template-line editor (primary tagging surface) and the
/// budget-line Add/Edit sheets. Callers show it only for `kind == .saving`;
/// `selection` is the goal id (`nil` = "Aucun objectif"). Reads goals from the
/// app-level `SavingsGoalStore` and refreshes them when it appears.
///
/// Two deliberately distinct modes:
/// - `.link` (default) — which goal a saving forecast feeds. Money goes IN.
/// - `.withdrawal` (PUL-329) — which goal funds an income. Money goes OUT, so
///   the list is the server-filtered set of funded goals and the field shows
///   what is left afterwards. There is no "Aucun objectif": once the caller
///   opted in, the choice is required.
/// - `.plannedWithdrawal` (PUL-329 v2) — which goal an income FORECAST announces
///   a withdrawal from. Nothing leaves the pot yet, so every goal is listed
///   whatever it holds today, and the preview reads the projection of the
///   budget's own month rather than the current balance.
///
/// PUL-313 — when the caller passes `budgetPeriod`, goals whose deadline falls
/// before it are listed but disabled: `enforce_savings_goal_line_link` would
/// reject the link with a 422. Listed, not hidden — a goal that silently
/// disappears is unexplainable. Template lines pass no period and stay
/// unfiltered; the trigger's horizon branch only bounds `budget_line`.
/// `budgetPeriod` can move under a live selection (a spread window extended past
/// a goal's deadline), so the selection is reconciled against it, not just the
/// goal list. A withdrawal passes no period: taking money out of a goal is not
/// bound by the deadline that bounds paying into it.
struct SavingsGoalPickerField: View {
    enum Mode {
        case link
        case withdrawal
        case plannedWithdrawal

        /// Both withdrawal modes read the goals list rather than the balance-bearing
        /// options, and neither is bound by the deadline that bounds paying in.
        var usesGoalsList: Bool { self != .withdrawal }
    }

    /// Local pre-check of a withdrawal choice, kept as a value so it can be
    /// reasoned about (and tested) without a view. The backend stays the
    /// authority; this only spares the user a round-trip.
    struct WithdrawalState: Equatable {
        let selectedOption: SavingsGoalWithdrawalOption?
        /// Already converted into the account currency (RG-009): comparing the
        /// typed amount would weigh a foreign-currency figure against a balance
        /// held in another one.
        let withdrawalAmount: Decimal?
        let isLoading: Bool
        let hasError: Bool

        /// What the goal holds once this income is taken out.
        var remainingAmount: Decimal? {
            guard let selectedOption, let withdrawalAmount else { return nil }
            return selectedOption.availableAmount - withdrawalAmount
        }

        /// Même bande que le serveur, qui accepte `debit <= disponible +
        /// tolérance`. Plus serré ici, le pré-contrôle refuserait des retraits
        /// que la requête aurait acceptés — vider un pot exactement, d'abord.
        var hasInsufficientBalance: Bool {
            guard let remainingAmount else { return false }
            return remainingAmount < -SavingsGoalProgress.withdrawalBalanceTolerance
        }

        var isReady: Bool {
            guard !isLoading, !hasError else { return false }
            guard selectedOption != nil, withdrawalAmount != nil else { return false }
            return !hasInsufficientBalance
        }
    }

    struct SelectionState: Equatable {
        let hasLoadedOnce: Bool
        let isLoading: Bool
        let hasError: Bool
        let knownGoalIDs: Set<String>
        /// Goals the caller's period can still link to — NOT every known goal. The
        /// period moves under a live selection when a spread window is extended.
        let linkableGoalIDs: Set<String>
        /// Whether the live selection was made in this picker rather than handed in.
        let pickedHere: Bool

        /// The two reasons a selection can go stale are NOT symmetric. A goal that
        /// vanished can never be saved again, so it drops whoever chose it. A goal
        /// that is merely out of horizon was legitimately linkable when the line was
        /// saved, and an edit sheet opens carrying it — withdrawing that on open
        /// would edit the user's data for them, so only a pick made here is taken back.
        func reconciled(_ selection: String?) -> String? {
            guard hasLoadedOnce, !isLoading, !hasError, let selection else {
                return selection
            }
            guard knownGoalIDs.contains(selection) else { return nil }
            if linkableGoalIDs.contains(selection) { return selection }
            return pickedHere ? nil : selection
        }
    }

    @Binding var selection: String?
    var mode: Mode = .link
    var budgetPeriod: BudgetPeriod?
    /// Withdrawal mode only: the amount actually taken out, already converted
    /// into the account currency (RG-009). Comparing the typed amount would
    /// weigh a foreign-currency figure against a balance held in another one.
    var withdrawalAmount: Decimal?
    /// Bump to re-read the options after the backend refused a stale balance.
    var withdrawalRefreshToken = 0
    /// Fires whenever the local checks agree the selection could be submitted.
    var onWithdrawalReadinessChange: (Bool) -> Void = { _ in }

    @State private var pickedHere = false

    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// The deadline period a goal puts a saving out of reach past, or `nil` when
    /// the link is allowed. Mirrors the trigger's own arithmetic through the
    /// shared period port — an undated goal has no horizon to fall outside of,
    /// and neither does a template line, which carries no period at all.
    static func exceededDeadline(
        for goal: SavingsGoal,
        budgetPeriod: BudgetPeriod?,
        payDayOfMonth: Int?
    ) -> BudgetPeriod? {
        guard let budgetPeriod, let targetDate = goal.targetDateValue else { return nil }
        let deadline = BudgetPeriodCalculator.periodForDate(targetDate, payDayOfMonth: payDayOfMonth)
        return BudgetPeriodCalculator.comparePeriods(budgetPeriod, deadline) > 0 ? deadline : nil
    }

    private func exceededDeadline(for goal: SavingsGoal) -> BudgetPeriod? {
        Self.exceededDeadline(
            for: goal,
            budgetPeriod: budgetPeriod,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    private var selectedGoal: SavingsGoal? {
        guard let selection else { return nil }
        return store.goals.first { $0.id == selection }
    }

    private var selectionState: SelectionState {
        SelectionState(
            hasLoadedOnce: store.hasLoadedOnce,
            isLoading: store.isLoading,
            hasError: store.error != nil,
            knownGoalIDs: Set(store.goals.map(\.id)),
            linkableGoalIDs: Set(store.goals.filter { exceededDeadline(for: $0) == nil }.map(\.id)),
            pickedHere: pickedHere
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(mode == .link ? "Objectif" : "Objectif utilisé")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            switch mode {
            case .withdrawal:
                SavingsGoalWithdrawalPicker(
                    selection: $selection,
                    withdrawalAmount: withdrawalAmount,
                    refreshToken: withdrawalRefreshToken,
                    onReadinessChange: onWithdrawalReadinessChange
                )
            case .plannedWithdrawal:
                SavingsGoalPlannedWithdrawalPicker(
                    selection: $selection,
                    withdrawalAmount: withdrawalAmount,
                    budgetPeriod: budgetPeriod,
                    onReadinessChange: onWithdrawalReadinessChange
                )
            case .link:
                pickerContent
            }
        }
        .task {
            guard mode.usesGoalsList else { return }
            await store.loadIfNeeded()
        }
        .onChange(of: selectionState, initial: true) { _, state in
            guard mode == .link else { return }
            selection = state.reconciled(selection)
        }
    }

    @ViewBuilder
    private var pickerContent: some View {
        if store.hasError {
            errorContent
        } else if !store.hasLoadedOnce {
            loadingContent
        } else if store.goals.isEmpty {
            emptyContent
        } else {
            menuContent
        }
    }

    private var errorContent: some View {
        savingsGoalFieldError { Task { await store.forceRefresh() } }
    }

    private var loadingContent: some View {
        savingsGoalFieldLoading()
    }

    private var emptyContent: some View {
        savingsGoalFieldSurface {
            Text("Aucun objectif disponible")
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .accessibilityLabel("Aucun objectif d'épargne disponible")
    }

    private var menuContent: some View {
        Menu {
            savingsGoalPickerButton(title: AppLocale.string("Aucun objectif"), isSelected: selection == nil) {
                pickedHere = true
                selection = nil
            }
            Divider()
            ForEach(store.goals) { goal in
                if let deadline = exceededDeadline(for: goal) {
                    savingsGoalPickerButton(
                        title: goal.name,
                        subtitle: AppLocale.string(
                            "Échéance dépassée · \(Formatters.monthName(for: deadline.month)) \(deadline.year)"
                        ),
                        isSelected: goal.id == selection
                    ) {}
                    .disabled(true)
                } else {
                    savingsGoalPickerButton(title: goal.name, isSelected: goal.id == selection) {
                        pickedHere = true
                        selection = goal.id
                    }
                }
            }
        } label: {
            savingsGoalFieldSurface {
                Text(selectedGoal?.name ?? AppLocale.string("Aucun objectif"))
                    .foregroundStyle(selectedGoal == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif d'épargne")
        .accessibilityValue(selectedGoal?.name ?? AppLocale.string("Aucun objectif"))
    }
}

// MARK: - Withdrawal mode (PUL-329)

/// Presentation of the funded-goal choice. Owns its own fetch: the option list
/// carries balances, which the goals cache does not.
private struct SavingsGoalWithdrawalPicker: View {
    @Binding var selection: String?
    let withdrawalAmount: Decimal?
    let refreshToken: Int
    let onReadinessChange: (Bool) -> Void

    @Environment(SavingsGoalStore.self) private var store
    @State private var options: [SavingsGoalWithdrawalOption] = []
    @State private var isLoading = true
    @State private var error: Error?

    private var state: SavingsGoalPickerField.WithdrawalState {
        SavingsGoalPickerField.WithdrawalState(
            selectedOption: selection.flatMap { id in options.first { $0.goalId == id } },
            withdrawalAmount: withdrawalAmount,
            isLoading: isLoading,
            hasError: error != nil
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            content
        }
        .task(id: refreshToken) { await load() }
        .onChange(of: state.isReady, initial: true) { _, isReady in
            onReadinessChange(isReady)
        }
    }

    @ViewBuilder
    private var content: some View {
        if error != nil {
            errorContent
        } else if isLoading {
            loadingContent
        } else if options.isEmpty {
            Text("Aucun objectif n'a d'argent disponible pour l'instant.")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
        } else {
            menuContent
            preview
        }
    }

    private var errorContent: some View {
        savingsGoalFieldError { Task { await load() } }
    }

    private var loadingContent: some View {
        savingsGoalFieldLoading()
    }

    private var menuContent: some View {
        Menu {
            ForEach(options) { option in
                savingsGoalPickerButton(
                    title: "\(option.name) · \(option.availableAmount.asAdaptiveCurrency(option.currency))",
                    isSelected: option.goalId == selection
                ) {
                    selection = option.goalId
                }
            }
        } label: {
            savingsGoalFieldSurface {
                Text(state.selectedOption?.name ?? AppLocale.string("Choisis un objectif"))
                    .foregroundStyle(state.selectedOption == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif utilisé")
        .accessibilityValue(state.selectedOption?.name ?? AppLocale.string("Aucun objectif choisi"))
    }

    @ViewBuilder
    private var preview: some View {
        if let selectedOption = state.selectedOption {
            if let remainingAmount = state.remainingAmount {
                Text(
                    "\(selectedOption.name) · "
                        + "\(selectedOption.availableAmount.asAdaptiveCurrency(selectedOption.currency)) → "
                        + remainingAmount.asAdaptiveCurrency(selectedOption.currency)
                )
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
                .sensitiveAmount()
            }
            if state.hasInsufficientBalance {
                Text("Ce montant dépasse ce que contient l'objectif.")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.destructivePrimary)
            } else if selectedOption.status == .completed {
                Text("Cet objectif reste atteint. Tu pourras le rouvrir depuis son détail.")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
    }

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            // A refresh means the displayed balances were refused: bypass the cache.
            options = try await store.fetchWithdrawalOptions(forceRefresh: refreshToken > 0)
            if let selection, !options.contains(where: { $0.goalId == selection }) {
                self.selection = nil
            }
        } catch {
            self.error = error
        }
    }
}

// MARK: - Shared field chrome

/// Internal rather than file-private: `SavingsGoalPlannedWithdrawalPicker` wears
/// the same chrome from its own file, and this file is already at the length
/// budget that made splitting it necessary.
@ViewBuilder
func savingsGoalFieldSurface(
    @ViewBuilder content: () -> some View
) -> some View {
    HStack(spacing: DesignTokens.Spacing.sm) {
        content()
    }
    .padding(.horizontal, DesignTokens.Spacing.lg)
    .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
    .background(
        Color.surfaceContainerLow,
        in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
    )
}

/// Failed load, with the retry the caller owns — the three pickers fetch from
/// three different places but say the same thing when the fetch fails.
/// `@MainActor` because `textLinkButtonStyle()` is: a free function inherits no
/// isolation from the view body that calls it.
@MainActor @ViewBuilder
func savingsGoalFieldError(retry: @escaping () -> Void) -> some View {
    savingsGoalFieldSurface {
        Image(systemName: "exclamationmark.triangle")
            .foregroundStyle(Color.destructivePrimary)
        Text("Impossible de charger les objectifs")
            .font(PulpeTypography.footnote)
            .foregroundStyle(Color.onSurfaceVariant)
        Spacer()
        Button("Réessayer", action: retry)
            .textLinkButtonStyle()
    }
    .accessibilityElement(children: .contain)
}

@ViewBuilder
func savingsGoalFieldLoading() -> some View {
    savingsGoalFieldSurface {
        ProgressView()
            .controlSize(.small)
        Text("Chargement des objectifs…")
            .font(PulpeTypography.footnote)
            .foregroundStyle(Color.onSurfaceVariant)
    }
    .accessibilityElement(children: .combine)
}

/// `subtitle` rides in the same button so the reason travels with the goal
/// it disables — a menu entry cannot carry a separate explanatory row.
@ViewBuilder
func savingsGoalPickerButton(
    title: String,
    subtitle: String? = nil,
    isSelected: Bool,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        if isSelected {
            Label(title, systemImage: "checkmark")
        } else {
            Text(title)
        }
        if let subtitle {
            Text(subtitle)
        }
    }
}
