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
struct SavingsGoalPickerField: View {
    enum Mode {
        case link
        case withdrawal
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

        var hasInsufficientBalance: Bool {
            guard let remainingAmount else { return false }
            return remainingAmount < 0
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
        let goalIDs: Set<String>

        func reconciled(_ selection: String?) -> String? {
            guard hasLoadedOnce, !isLoading, !hasError, let selection else {
                return selection
            }
            return goalIDs.contains(selection) ? selection : nil
        }
    }

    @Binding var selection: String?
    var mode: Mode = .link
    /// Withdrawal mode only: the amount actually taken out, already converted
    /// into the account currency (RG-009). Comparing the typed amount would
    /// weigh a foreign-currency figure against a balance held in another one.
    var withdrawalAmount: Decimal?
    /// Bump to re-read the options after the backend refused a stale balance.
    var withdrawalRefreshToken = 0
    /// Fires whenever the local checks agree the selection could be submitted.
    var onWithdrawalReadinessChange: (Bool) -> Void = { _ in }

    @Environment(SavingsGoalStore.self) private var store

    private var selectedGoal: SavingsGoal? {
        guard let selection else { return nil }
        return store.goals.first { $0.id == selection }
    }

    private var selectionState: SelectionState {
        SelectionState(
            hasLoadedOnce: store.hasLoadedOnce,
            isLoading: store.isLoading,
            hasError: store.error != nil,
            goalIDs: Set(store.goals.map(\.id))
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(mode == .withdrawal ? "Objectif utilisé" : "Objectif")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            if mode == .withdrawal {
                SavingsGoalWithdrawalPicker(
                    selection: $selection,
                    withdrawalAmount: withdrawalAmount,
                    refreshToken: withdrawalRefreshToken,
                    onReadinessChange: onWithdrawalReadinessChange
                )
            } else {
                pickerContent
            }
        }
        .task {
            guard mode == .link else { return }
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
        savingsGoalFieldSurface {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Color.destructivePrimary)
            Text("Impossible de charger les objectifs")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
            Spacer()
            Button("Réessayer") {
                Task { await store.forceRefresh() }
            }
            .textLinkButtonStyle()
        }
        .accessibilityElement(children: .contain)
    }

    private var loadingContent: some View {
        savingsGoalFieldSurface {
            ProgressView()
                .controlSize(.small)
            Text("Chargement des objectifs…")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .accessibilityElement(children: .combine)
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
            savingsGoalPickerButton(title: "Aucun objectif", isSelected: selection == nil) {
                selection = nil
            }
            Divider()
            ForEach(store.goals) { goal in
                savingsGoalPickerButton(title: goal.name, isSelected: goal.id == selection) {
                    selection = goal.id
                }
            }
        } label: {
            savingsGoalFieldSurface {
                Text(selectedGoal?.name ?? "Aucun objectif")
                    .foregroundStyle(selectedGoal == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif d'épargne")
        .accessibilityValue(selectedGoal?.name ?? "Aucun objectif")
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
        savingsGoalFieldSurface {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Color.destructivePrimary)
            Text("Impossible de charger les objectifs")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
            Spacer()
            Button("Réessayer") { Task { await load() } }
                .textLinkButtonStyle()
        }
        .accessibilityElement(children: .contain)
    }

    private var loadingContent: some View {
        savingsGoalFieldSurface {
            ProgressView()
                .controlSize(.small)
            Text("Chargement des objectifs…")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .accessibilityElement(children: .combine)
    }

    private var menuContent: some View {
        Menu {
            ForEach(options) { option in
                savingsGoalPickerButton(
                    title: "\(option.name) · \(option.availableAmount.asCompactCurrency(option.currency))",
                    isSelected: option.goalId == selection
                ) {
                    selection = option.goalId
                }
            }
        } label: {
            savingsGoalFieldSurface {
                Text(state.selectedOption?.name ?? "Choisis un objectif")
                    .foregroundStyle(state.selectedOption == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif utilisé")
        .accessibilityValue(state.selectedOption?.name ?? "Aucun objectif choisi")
    }

    @ViewBuilder
    private var preview: some View {
        if let selectedOption = state.selectedOption {
            if let remainingAmount = state.remainingAmount {
                Text(
                    "\(selectedOption.name) · "
                        + "\(selectedOption.availableAmount.asCompactCurrency(selectedOption.currency)) → "
                        + remainingAmount.asCompactCurrency(selectedOption.currency)
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

@ViewBuilder
private func savingsGoalFieldSurface(
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

@ViewBuilder
private func savingsGoalPickerButton(
    title: String,
    isSelected: Bool,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        if isSelected {
            Label(title, systemImage: "checkmark")
        } else {
            Text(title)
        }
    }
}
