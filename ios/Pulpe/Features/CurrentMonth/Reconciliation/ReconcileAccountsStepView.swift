import SwiftUI

/// Step 1 of « Comparer avec mes comptes »: the balance of each account, as the bank shows it,
/// and what I owe. Every input lives in `flow`; « Comparer » moves it to step 2.
struct ReconcileAccountsStepView: View {
    let flow: ReconcileAccountsFlow
    let currency: SupportedCurrency
    /// Items a saving prévision of the month feeds: the add sheet never offers them.
    let fedAssetIds: Set<String>

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @FocusState private var focus: ReconcileAccountField?
    @State private var isAdding = false
    @State private var pendingFocus: ReconcileAccountField?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                header
                accountsCard
                if !flow.hasOwedRow { cardHelp }
                totalCard
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.xl)
            // Inside the scroll view: one behind it never gets the tap, the scroll view sits over it.
            .dismissKeyboardOnTap()
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .background(Color.sheetBackground)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { footer }
        .sheet(isPresented: $isAdding, onDismiss: { focus = pendingFocus }, content: {
            ReconcileAddAccountSheet(flow: flow, fedAssetIds: fedAssetIds) { pendingFocus = $0 }
        })
        .task {
            // « Ajouter ce que je dois » on step 2 hands over the row to name; otherwise opening on an empty
            // row focuses it, as the add sheets do.
            let handed = flow.takeRowToFocus().map(ReconcileAccountField.label)
            let empty = flow.accounts.first.flatMap { $0.amountText.isEmpty ? $0 : nil }
            guard let target = handed ?? empty.map({ $0.label.isEmpty ? .label($0.id) : .amount($0.id) })
            else { return }
            try? await Task.sleep(for: .milliseconds(DesignTokens.Animation.pushAutofocusDelayMs))
            guard !Task.isCancelled else { return }
            focus = target
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Étape 1 sur 2")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            Text("Combien as-tu aujourd'hui ?")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Text("Tape ce que ta banque affiche aujourd'hui, compte par compte.")
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Accounts

    private var accountsCard: some View {
        FormCard {
            ForEach(Array(flow.accounts.enumerated()), id: \.element.id) { index, account in
                ReconcileAccountRow(
                    flow: flow, account: account, number: index + 1, currency: currency, focus: $focus
                ) {
                    focus = nil
                    withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) {
                        flow.removeAccount(id: account.id)
                    }
                }
                FormRowDivider()
            }
            SectionAddRow(title: AppLocale.string("Ajouter un compte")) { isAdding = true }
                .accessibilityIdentifier("reconcileAddAccountButton")
        }
    }

    /// Until a « Je dois » row exists, a card paid but not yet billed has nowhere to go.
    private var cardHelp: some View {
        FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("Tu paies aussi par carte de crédit, PayPal ou Klarna ?")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Button(AppLocale.string("Ajouter ce que je dois")) {
                    focus = .label(flow.addFreeAccount(isOwed: true))
                }
                .secondaryButtonStyle(size: .small)
                .accessibilityIdentifier("reconcileAddOwedButton")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    // MARK: - Total

    private var totalCard: some View {
        FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                // Stacked at accessibility sizes, so « En tout » never breaks beside the figure.
                let layout = dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: DesignTokens.Spacing.xs))
                    : AnyLayout(HStackLayout(spacing: DesignTokens.Spacing.md))
                layout {
                    Text("En tout")
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(verbatim: (flow.total ?? 0).asCurrency(currency))
                        .font(PulpeTypography.totalAmount)
                        // Muted until a figure reads, as on the web: a grey 0.00 is not a balance.
                        .foregroundStyle(flow.total == nil ? Color.textSecondary : Color.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.compact)
                        .layoutPriority(1)
                        .sensitiveAmount()
                        .accessibilityIdentifier("reconcileTotal")
                }
                if flow.hasOwedRow, flow.total != nil {
                    let have = AccountReconciliation.amount(cents: flow.haveCents).asInlineCurrency(currency)
                    let owe = AccountReconciliation.amount(cents: flow.oweCents).asInlineCurrency(currency)
                    Text(AppLocale.string("\(have) − \(owe) que tu dois"))
                        .font(PulpeTypography.captionRegular)
                        .monospacedDigit()
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .sensitiveAmount()
                        .accessibilityIdentifier("reconcileTotalDetail")
                }
            }
            .accessibilityElement(children: .combine)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    private var footer: some View {
        Button(AppLocale.string("Comparer")) {
            focus = nil
            // The list used at « Comparer » is the one worth remembering: step 2 can be abandoned.
            if flow.totalCents != nil { ReconcileFreeAccountsStore.shared.save(flow.freeAccountEntries) }
            flow.compare()
        }
        .primaryButtonStyle(isEnabled: flow.totalCents != nil)
        .disabled(flow.totalCents == nil)
        .accessibilityIdentifier("reconcileCompareButton")
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }
}
