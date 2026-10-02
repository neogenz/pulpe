import SwiftUI

/// Step 1 of "Rapprocher mes comptes": one balance to start with, more accounts on
/// demand. The total follows every keystroke; back leaves the flow.
struct ReconcileAccountsEntryStep: View {
    let flow: ReconcileAccountsFlow
    let currency: SupportedCurrency
    let onLeave: @MainActor () -> Void

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case label(UUID)
        case amount(UUID)
    }

    init(flow: ReconcileAccountsFlow, currency: SupportedCurrency, onLeave: @escaping @MainActor () -> Void) {
        self.flow = flow
        self.currency = currency
        self.onLeave = onLeave
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Saisis le solde actuel de chaque compte, tel que ta banque l'affiche.")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            ForEach(Array(flow.accounts.enumerated()), id: \.element.id) { index, account in
                accountCard(account, number: index + 1)
            }

            Button(action: addAccount) {
                Label("Ajouter un compte", systemImage: "plus")
                    .font(PulpeTypography.labelLarge)
            }
            .textLinkButtonStyle()
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .accessibilityIdentifier("reconcileAddAccountButton")
        }
        .reconcileStep(AppLocale.string("Tes comptes"), onClose: onLeave) {
            if let total = flow.total {
                totalRow(total)
            }
            Button("Continuer") { flow.continueFromAccounts() }
                .disabled(!flow.canContinue)
                .primaryButtonStyle(isEnabled: flow.canContinue)
                .accessibilityIdentifier("reconcileContinueButton")
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(action: onLeave) {
                    Image(systemName: "chevron.backward")
                }
                .accessibilityLabel("Retour")
            }
        }
        .keyboardFieldNavigation(focus: $focusedField, order: fieldOrder)
        .task {
            // Opening on an empty flow focuses its one amount, as the add sheets do.
            guard flow.path.isEmpty, let first = flow.accounts.first, first.amountText.isEmpty else { return }
            try? await Task.sleep(for: .milliseconds(DesignTokens.Animation.pushAutofocusDelayMs))
            guard !Task.isCancelled else { return }
            focusedField = .amount(first.id)
        }
    }

    private var fieldOrder: [Field] {
        flow.accounts.flatMap { [Field.label($0.id), Field.amount($0.id)] }
    }

    // MARK: - Account card

    private func accountCard(_ account: AccountReconciliation.Account, number: Int) -> some View {
        let row = accountBinding(for: account.id)
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            FormCard {
                FormTextField(
                    hint: AppLocale.string("Optionnel"),
                    text: row.label,
                    label: AppLocale.string("Nom du compte"),
                    accessibilityLabel: AppLocale.string("Nom du compte \(number)"),
                    focusBinding: $focusedField,
                    field: .label(account.id),
                    style: .row
                )
                FormRowDivider()
                amountRow(row, number: number)
                FormRowDivider()
                Toggle(isOn: row.isOverdraft) {
                    Text("À découvert")
                        .font(PulpeTypography.bodyLarge)
                }
                .tint(Color.financialOverBudget)
                .frame(minHeight: DesignTokens.ListRow.minHeight)
                .accessibilityLabel(AppLocale.string("Compte \(number) à découvert"))
                if flow.canRemoveAccount(id: account.id) {
                    FormRowDivider()
                    removeButton(for: account.id, number: number)
                }
            }
            if flow.hasInvalidAmount(id: account.id) {
                Label("Montant non reconnu : chiffres et 2 décimales au plus", systemImage: "exclamationmark.circle")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.errorPrimary)
            }
        }
    }

    /// The decimal pad has no minus key: the overdraft switch carries the sign, and the
    /// row shows it in front of the digits.
    private func amountRow(_ account: Binding<AccountReconciliation.Account>, number: Int) -> some View {
        let id = account.wrappedValue.id
        let isOverdraft = account.wrappedValue.isOverdraft
        return HStack(spacing: DesignTokens.Spacing.md) {
            Text("Solde")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            HStack(spacing: DesignTokens.Spacing.xs) {
                if isOverdraft {
                    Text(verbatim: "\u{2212}")
                }
                TextField(Decimal.zero.asAmount(for: currency), text: account.amountText)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .focused($focusedField, equals: .amount(id))
                    .accessibilityLabel(AppLocale.string("Solde du compte \(number)"))
                Text(currency.symbol)
                    .foregroundStyle(Color.textTertiary)
            }
            .font(PulpeTypography.bodyLarge)
            .monospacedDigit()
            .foregroundStyle(isOverdraft ? Color.financialOverBudget : Color.textPrimary)
            .sensitiveAmount()
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .contentShape(.interaction, Rectangle())
        .onTapGesture { focusedField = .amount(id) }
    }

    private func removeButton(for id: UUID, number: Int) -> some View {
        Button {
            focusedField = nil
            withAnimation(DesignTokens.Animation.gentleSpring) {
                flow.removeAccount(id: id)
            }
        } label: {
            Label("Retirer ce compte", systemImage: "minus.circle")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.errorPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel(AppLocale.string("Retirer le compte \(number)"))
    }

    private func totalRow(_ total: Decimal) -> some View {
        HStack {
            Text("Total")
                .font(PulpeTypography.labelLarge)
            Spacer()
            Text(total.asCurrency(currency))
                .font(PulpeTypography.labelLargeBold)
                .monospacedDigit()
                .contentTransition(.numericText())
                .sensitiveAmount()
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Actions

    private func addAccount() {
        let id = withAnimation(DesignTokens.Animation.gentleSpring) {
            flow.addAccount()
        }
        focusedField = .amount(id)
    }

    /// Rows are addressed by id, so removing one never shifts another row's binding.
    private func accountBinding(for id: UUID) -> Binding<AccountReconciliation.Account> {
        Binding(
            get: { flow.accounts.first { $0.id == id } ?? AccountReconciliation.Account(id: id) },
            set: { updated in
                guard let index = flow.accounts.firstIndex(where: { $0.id == id }) else { return }
                flow.accounts[index] = updated
            }
        )
    }
}
