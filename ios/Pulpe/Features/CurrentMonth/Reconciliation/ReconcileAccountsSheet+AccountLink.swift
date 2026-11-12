import SwiftUI

/// One account of the sheet: its name facing its bordered balance, then what is known about
/// it on full-width lines below. With « Mon patrimoine » on, the account is picked among mine
/// or typed as another one, which a switch can add to Mon patrimoine.
struct ReconcileAccountRow: View {
    let flow: ReconcileAccountsFlow
    let account: AccountReconciliation.Account
    let number: Int
    let currency: SupportedCurrency
    var focus: FocusState<ReconcileAccountsSheet.Field?>.Binding
    let remove: () -> Void

    private var asset: Asset? { flow.asset(id: account.id) }
    private var isInvalid: Bool { flow.hasInvalidAmount(id: account.id) }
    private var choices: [Asset] { flow.choices(for: account.id) }

    /// Taking a followed account off the list stops following it: the action says so.
    private var removeTitle: String {
        asset?.inPulpe == true
            ? AppLocale.string("Ne plus suivre ce compte") : AppLocale.string("Retirer ce compte")
    }

    /// Rows are addressed by id, so removing one never shifts another row's binding.
    private var row: Binding<AccountReconciliation.Account> {
        Binding(
            get: { flow.accounts.first { $0.id == account.id } ?? account },
            set: { updated in
                guard let index = flow.accounts.firstIndex(where: { $0.id == account.id }) else { return }
                flow.accounts[index] = updated
            }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                HStack(spacing: DesignTokens.Spacing.md) {
                    whichAccount.frame(maxWidth: .infinity, alignment: .leading)
                    amountField
                }
                details
            }
            if flow.linksToNetWorth, asset == nil { addToNetWorthToggle }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .contextMenu {
            if flow.canRemoveAccount(id: account.id) {
                Button(removeTitle, systemImage: "minus.circle", role: .destructive, action: remove)
            }
        }
        .accessibilityActions {
            if flow.canRemoveAccount(id: account.id) {
                Button(removeTitle, action: remove)
            }
        }
    }

    // MARK: - Which account

    /// The name is the menu for one of my accounts; another account types its name, and the
    /// menu shrinks to the chevron beside it.
    @ViewBuilder private var whichAccount: some View {
        if asset != nil {
            accountMenu
        } else {
            HStack(spacing: DesignTokens.Spacing.sm) {
                nameField
                if !choices.isEmpty { accountMenu }
            }
        }
    }

    /// Full-width lines under the name and the balance, so none of them wraps beside the field.
    private var details: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            // Asked in the neutral ink: nothing was done wrong yet.
            if flow.isNameMissing(id: account.id) {
                Text("Donne un nom à ce compte pour l'ajouter")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
            if let asset { LinkedAccountHint(asset: asset) }
            if isInvalid {
                Text("Chiffres et 2 décimales au plus")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.errorPrimary)
            }
            negativeLink
        }
    }

    /// Same pattern as the Type menu of the element sheet. Removing lives here too: a long
    /// press alone would hide it.
    private var accountMenu: some View {
        Menu {
            ForEach(choices) { choice in
                Button {
                    flow.selectAccount(id: account.id, choice)
                } label: {
                    if choice.id == asset?.id {
                        Label(choice.name, systemImage: "checkmark")
                    } else {
                        Text(choice.name)
                    }
                }
            }
            // A typed line is already another account: offering it again would erase its name.
            if asset != nil {
                Button(AppLocale.string("Autre compte…")) {
                    flow.selectAccount(id: account.id, nil)
                    focus.wrappedValue = .label(account.id)
                }
            }
            if flow.canRemoveAccount(id: account.id) {
                Divider()
                Button(removeTitle, systemImage: "minus.circle", role: .destructive, action: remove)
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.xs) {
                if let asset {
                    Text(asset.name)
                        .font(PulpeTypography.rowTitleRegular)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.up.chevron.down")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    // Alone beside a typed name, the chevron is the whole target.
                    .frame(minWidth: asset == nil ? DesignTokens.TapTarget.minimum : nil)
            }
        }
        .expandedTapArea()
        .accessibilityLabel(AppLocale.string("Compte \(number)"))
        .accessibilityValue(asset?.name ?? AppLocale.string("Autre compte…"))
        .accessibilityIdentifier("reconcileAccountMenu")
    }

    private var nameField: some View {
        TextField(AppLocale.string("Nom du compte"), text: row.label)
            .font(PulpeTypography.rowTitleRegular)
            .foregroundStyle(Color.textPrimary)
            .focused(focus, equals: .label(account.id))
            .submitLabel(.next)
            .onSubmit { focus.wrappedValue = .amount(account.id) }
            .accessibilityLabel(AppLocale.string("Nom du compte \(number)"))
    }

    /// The decimal pad has no minus key: a balance that counts against the user (a credit
    /// card, an overdraft) is said with this line.
    private var negativeLink: some View {
        Button {
            row.wrappedValue.isNegative.toggle()
        } label: {
            Text(account.isNegative ? "Comptée en négatif" : "Compter en négatif")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(account.isNegative ? Color.textSecondary : Color.pulpePrimary)
        }
        .expandedTapArea()
        .textLinkButtonStyle()
        .accessibilityAddTraits(account.isNegative ? .isSelected : [])
        .accessibilityHint(AppLocale.string("Carte de crédit, découvert"))
    }

    // MARK: - Mon patrimoine

    /// A setting of its own under the line, with what it does: not one more control in the row.
    private var addToNetWorthToggle: some View {
        Toggle(isOn: Binding(
            get: { flow.rowAccount(id: account.id) == .other(addToNetWorth: true) },
            set: { isOn in
                flow.setAddToNetWorth(id: account.id, isOn)
                if isOn, flow.isNameMissing(id: account.id) { focus.wrappedValue = .label(account.id) }
            }
        )) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Ajouter à Mon patrimoine")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                Text("Je garde ce compte et je mets son solde à jour à chaque rapprochement.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Color.pulpePrimary)
        .accessibilityIdentifier("reconcileAddToNetWorth")
    }

    // MARK: - Balance

    private var amountField: some View {
        let isFocused = focus.wrappedValue == .amount(account.id)
        return HStack(spacing: DesignTokens.Spacing.xxs) {
            if account.isNegative {
                Text(verbatim: "\u{2212}")
            }
            TextField(Decimal.zero.asAmount(for: currency), text: row.amountText)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .fixedSize()
                .focused(focus, equals: .amount(account.id))
                .accessibilityLabel(AppLocale.string("Solde du compte \(number)"))
        }
        .font(PulpeTypography.impactAmount)
        .foregroundStyle(Color.textPrimary)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(minWidth: DesignTokens.Control.inlineAmountFieldMinWidth, alignment: .trailing)
        .frame(minHeight: DesignTokens.FrameHeight.buttonSmall)
        .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.input))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                .strokeBorder(
                    isInvalid ? Color.errorPrimary : isFocused ? Color.pulpePrimary : Color.outline,
                    lineWidth: isFocused || isInvalid
                        ? DesignTokens.Control.inputFocusBorder
                        : DesignTokens.BorderWidth.thin
                )
        }
        .sensitiveAmount()
        .contentShape(.interaction, Rectangle())
        .onTapGesture { focus.wrappedValue = .amount(account.id) }
    }
}
