import SwiftUI

/// The field a row focuses: its name or its amount.
enum ReconcileAccountField: Hashable {
    case label(UUID)
    case amount(UUID)
}

/// One account of step 1. A « Mon patrimoine » item shows its side as a fixed label; a free row
/// names itself and picks « J'ai » or « Je dois ». The amount sits on its own line so no
/// figure shares a line with a name.
struct ReconcileAccountRow: View {
    let flow: ReconcileAccountsFlow
    let account: AccountReconciliation.Account
    let number: Int
    let currency: SupportedCurrency
    var focus: FocusState<ReconcileAccountField?>.Binding
    let remove: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var asset: Asset? { flow.asset(id: account.id) }
    private var isInvalid: Bool { flow.hasInvalidAmount(id: account.id) }
    private var displayName: String {
        let name = (asset?.name ?? account.label).trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? AppLocale.string("Compte \(number)") : name
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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let asset {
                // Stacked at accessibility sizes, so a long name wraps instead of losing its tail;
                // the tag and ✕ stay together on the line below.
                if dynamicTypeSize.isAccessibilitySize {
                    assetName(asset)
                    HStack(spacing: DesignTokens.Spacing.md) {
                        sideTag
                        Spacer(minLength: 0)
                        removeButton
                    }
                } else {
                    HStack(spacing: DesignTokens.Spacing.md) {
                        assetName(asset)
                        sideTag
                        removeButton
                    }
                }
            } else {
                HStack(spacing: DesignTokens.Spacing.md) {
                    nameField
                    removeButton
                }
            }
            if asset == nil { sidePicker }
            amountLine
            if isInvalid {
                Text("Chiffres et 2 décimales au plus")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.errorPrimary)
            }
            if let asset {
                // A card's figure is what is owed so far, not the limit the bank also shows.
                if asset.direction == .owe { caption("Tout ce que tu dois, achats récents compris. Pas ta limite.") }
                caption("Mis à jour dans Mon patrimoine.")
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private func assetName(_ asset: Asset) -> some View {
        Text(asset.name)
            .font(PulpeTypography.rowTitle)
            .foregroundStyle(Color.textPrimary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The fixed side of a Mon patrimoine item: a small tag, not a control.
    private var sideTag: some View {
        let isOwed = account.isNegative
        let color = isOwed ? Color.financialOverBudget : Color.pulpePrimary
        return (isOwed ? Text("Je dois") : Text("J'ai"))
            .font(PulpeTypography.captionRegular.weight(.semibold))
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, DesignTokens.Spacing.sm)
            .padding(.vertical, DesignTokens.Spacing.xxs)
            .background(color.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
    }

    private func caption(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var nameField: some View {
        TextField(AppLocale.string("Nom du compte"), text: row.label)
            .font(PulpeTypography.rowTitle)
            .foregroundStyle(Color.textPrimary)
            .focused(focus, equals: .label(account.id))
            .submitLabel(.next)
            .onSubmit { focus.wrappedValue = .amount(account.id) }
            .accessibilityLabel(AppLocale.string("Nom du compte \(number)"))
    }

    private var removeButton: some View {
        Button(action: remove) {
            Image(systemName: "xmark")
                .font(PulpeTypography.captionRegular.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
        }
        .iconButtonStyle()
        .accessibilityLabel(AppLocale.string("Retirer \(displayName) de la liste"))
        .accessibilityIdentifier("reconcileRemoveAccount")
    }

    private var sidePicker: some View {
        SegmentedPicker(selection: row.isNegative, title: nil, options: [false, true]) { isOwed in
            isOwed ? Text("Je dois") : Text("J'ai")
        }
        .accessibilityLabel(AppLocale.string("\(displayName) : ce que j'ai ou ce que je dois"))
        .accessibilityIdentifier("reconcileSidePicker")
    }

    // MARK: - Balance

    private var amountLine: some View {
        let isFocused = focus.wrappedValue == .amount(account.id)
        return HStack(spacing: DesignTokens.Spacing.sm) {
            Text(verbatim: currency.symbol)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            // A pasted « -800 » already carries its sign: no second one in front.
            let typed = account.amountText.trimmingCharacters(in: .whitespacesAndNewlines)
            if account.isNegative, !typed.hasPrefix("-"), !typed.hasPrefix("\u{2212}") {
                Text(verbatim: "\u{2212}")
            }
            TextField(Decimal.zero.asAmount(for: currency), text: row.amountText)
                .keyboardType(.decimalPad)
                .lineLimit(1)
                .focused(focus, equals: .amount(account.id))
                .accessibilityLabel(AppLocale.string("Solde du compte \(number)"))
                // The value only, as the web: the field and its symbol stay readable.
                .sensitiveAmount()
        }
        .font(PulpeTypography.impactAmount)
        .foregroundStyle(Color.textPrimary)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
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
        .contentShape(.interaction, Rectangle())
        .onTapGesture { focus.wrappedValue = .amount(account.id) }
    }
}
