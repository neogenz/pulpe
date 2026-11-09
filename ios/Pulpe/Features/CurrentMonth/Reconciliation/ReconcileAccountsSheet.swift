import SwiftUI

/// What the sheet reads to point a movement: the month's movements and prévisions, and the
/// caller's own toggle, which reports whether the server took it.
struct ReconciliationChecking {
    let items: [CurrentMonthStore.CheckableItem]
    let transactions: [Transaction]
    let budgetLines: [BudgetLine]
    let syncingTransactionIds: Set<String>
    let syncingBudgetLineIds: Set<String>
    let toggle: @MainActor (CurrentMonthStore.CheckableItem) async -> Bool
}

/// « Comparer avec mes comptes » (PUL-351, V2): one sheet. The balances typed by the user, the
/// gap to the pointed balance, the movement that probably explains it, and the two ways to
/// close it: point that movement, or write one adjustment. Every input lives in `flow`, owned
/// here, so closing discards it and writes nothing.
struct ReconcileAccountsSheet: View {
    /// The loaded month, read again on every render.
    struct Month {
        let budgetId: String
        let realizedMetrics: BudgetFormulas.RealizedMetrics
        let rollover: Decimal
        /// A pointing not yet confirmed: its rollback would move the balance under a
        /// verdict already acted on, so the actions wait for it.
        var hasPointingInFlight = false
    }

    let month: Month
    let checking: ReconciliationChecking

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var flow: ReconcileAccountsFlow
    @State private var submitSuccessTrigger = false
    @State private var isPointing = false
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case label(UUID)
        case amount(UUID)
    }

    init(
        month: Month,
        checking: ReconciliationChecking,
        dependencies: AddTransactionDependencies = .live,
        linkedAccounts: [Asset] = [],
        onAdjustmentCreated: @escaping @MainActor (Transaction) -> Void
    ) {
        self.month = month
        self.checking = checking
        _flow = State(initialValue: ReconcileAccountsFlow(
            budgetId: month.budgetId,
            adjustmentLabel: AppLocale.string("Ajustement"),
            createTransaction: dependencies.createTransaction,
            onAdjustmentCreated: onAdjustmentCreated,
            onCompleted: { completion in
                AnalyticsService.shared.capture(
                    .accountReconciliationCompleted,
                    properties: completion.analyticsProperties
                )
            },
            linkedAccounts: linkedAccounts
        ))
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }
    private var realizedBalance: Decimal { month.realizedMetrics.realizedBalance }
    private var verdict: AccountReconciliation.Verdict? { flow.verdict(realizedBalance: realizedBalance) }
    private var gap: Decimal? { flow.difference(realizedBalance: realizedBalance) }

    private var missedMovement: Transaction? {
        guard let gap else { return nil }
        return ReconcileAccountsFlow.likelyMissedMovement(
            gap: gap, among: checking.transactions, lines: checking.budgetLines
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text("Saisis le solde de chaque compte, tel que ta banque l'affiche.")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    accountsCard
                    if flow.hasLinkedAccounts { LinkedAccountsFootnote() }
                    if let total = flow.total { totalsCard(total) }
                    if let missedMovement { missedSection(missedMovement) }
                    outcomeBlock
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xl)
                .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: verdict)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.sheetBackground)
            .dismissKeyboardOnTap()
            .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { footer }
            .navigationTitle(AppLocale.string("Comparer avec mes comptes"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton().disabled(flow.isSubmitting)
                }
            }
        }
        .standardSheetPresentation()
        // Nothing leaves the sheet while the write is in flight.
        .interactiveDismissDisabled(flow.isSubmitting)
        .onChange(of: flow.shouldClose(loadedBudgetId: month.budgetId)) { _, shouldClose in
            if shouldClose { dismiss() }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .recordsLinkedSnapshots(of: flow)
        .suppressesTips()
        .task {
            // Opening on an empty flow focuses its one amount, as the add sheets do.
            guard let first = flow.accounts.first, first.amountText.isEmpty else { return }
            try? await Task.sleep(for: .milliseconds(DesignTokens.Animation.pushAutofocusDelayMs))
            guard !Task.isCancelled else { return }
            focusedField = .amount(first.id)
        }
    }
}

// MARK: - Sections

extension ReconcileAccountsSheet {
    // MARK: - Accounts

    private var accountsCard: some View {
        FormCard {
            ForEach(Array(flow.accounts.enumerated()), id: \.element.id) { index, account in
                accountRow(account, number: index + 1)
                FormRowDivider()
            }
            SectionAddRow(title: AppLocale.string("Ajouter un compte")) {
                let id = withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) { flow.addAccount() }
                focusedField = .amount(id)
            }
            .accessibilityIdentifier("reconcileAddAccountButton")
        }
    }

    /// The name on the leading edge, the bordered balance on the trailing one. The decimal pad
    /// has no minus key: a balance that counts against the user (a credit card, an overdraft)
    /// is said with the line under the name.
    private func accountRow(_ account: AccountReconciliation.Account, number: Int) -> some View {
        let row = accountBinding(for: account.id)
        let isInvalid = flow.hasInvalidAmount(id: account.id)
        return HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                TextField(AppLocale.string("Nom du compte"), text: row.label)
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                    .focused($focusedField, equals: .label(account.id))
                    .submitLabel(.next)
                    .onSubmit { focusedField = .amount(account.id) }
                    .accessibilityLabel(AppLocale.string("Nom du compte \(number)"))
                Button {
                    row.wrappedValue.isNegative.toggle()
                } label: {
                    Text(account.isNegative ? "Comptée en négatif" : "Compter en négatif")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(account.isNegative ? Color.textSecondary : Color.pulpePrimary)
                }
                .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
                .textLinkButtonStyle()
                .accessibilityAddTraits(account.isNegative ? .isSelected : [])
                .accessibilityHint(AppLocale.string("Carte de crédit, découvert"))
                if let linked = flow.lastValueHint(id: account.id) { LinkedAccountHint(asset: linked) }
                if isInvalid {
                    Text("Chiffres et 2 décimales au plus")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.errorPrimary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            amountField(row, number: number, isInvalid: isInvalid)
        }
        .padding(.vertical, DesignTokens.Spacing.sm)
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .contextMenu {
            if flow.canRemoveAccount(id: account.id) {
                Button(AppLocale.string("Retirer ce compte"), systemImage: "minus.circle", role: .destructive) {
                    removeAccount(account.id)
                }
            }
        }
        .accessibilityActions {
            if flow.canRemoveAccount(id: account.id) {
                Button(AppLocale.string("Retirer ce compte")) { removeAccount(account.id) }
            }
        }
    }

    private func amountField(
        _ account: Binding<AccountReconciliation.Account>,
        number: Int,
        isInvalid: Bool
    ) -> some View {
        let id = account.wrappedValue.id
        let isFocused = focusedField == .amount(id)
        return HStack(spacing: DesignTokens.Spacing.xxs) {
            if account.wrappedValue.isNegative {
                Text(verbatim: "\u{2212}")
            }
            TextField(Decimal.zero.asAmount(for: currency), text: account.amountText)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .fixedSize()
                .focused($focusedField, equals: .amount(id))
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
        .onTapGesture { focusedField = .amount(id) }
    }

    // MARK: - Totals

    private func totalsCard(_ total: Decimal) -> some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            totalLine(AppLocale.string("Sur tes comptes"), amount: total.asAmount(for: currency))
            totalLine(AppLocale.string("Ton solde pointé"), amount: realizedBalance.asAmount(for: currency))
            Divider().overlay(Color.outlineVariant)
            totalLine(
                AppLocale.string("Écart"),
                amount: (gap ?? 0).asFormulaAmount(for: currency),
                tint: gap == 0 ? .pulpePrimary : .financialOverBudget,
                isEmphasized: true
            )
            .accessibilityIdentifier("reconcileGap")
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
    }

    private func totalLine(
        _ title: String,
        amount: String,
        tint: Color = .textPrimary,
        isEmphasized: Bool = false
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Text(title)
                .font(isEmphasized ? PulpeTypography.rowTitle : PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: amount)
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .layoutPriority(1)
                .sensitiveAmount()
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Missed movement

    private func missedSection(_ transaction: Transaction) -> some View {
        let lineName = transaction.budgetLineId.flatMap { id in
            checking.budgetLines.first { $0.id == id }?.name
        }
        let subtitle = [
            lineName ?? PendingWording.unplanned,
            AppLocale.string("ajouté le \(Formatters.dayMonthLabel(for: transaction.transactionDate))"),
            AppLocale.string("même montant"),
        ].joined(separator: " · ")
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Sans doute passé sans être pointé")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .padding(.leading, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)
            PulpeListRow(title: transaction.name, subtitle: subtitle, showsChevron: false) {
                Text(verbatim: transaction.amount.asAmount(for: currency))
                    .sensitiveAmount()
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
            .accessibilityIdentifier("reconcileMissedMovement")
        }
    }

    // MARK: - Outcome

    @ViewBuilder
    private var outcomeBlock: some View {
        switch verdict {
        case .upToDate:
            InfoBanner(
                .ok,
                systemImage: "checkmark.circle",
                text: AppLocale.string("Tes comptes et ton solde pointé sont identiques, au centime près.")
            )
        case .adjustment(let kind, let amount):
            let impact = MovementImpact.compute(
                lines: checking.budgetLines,
                transactions: checking.transactions,
                rollover: month.rollover,
                draft: .init(kind: kind, amount: amount, lineId: nil)
            )
            let signedGap = (gap ?? 0).asFormulaAmount(for: currency)
            let before = impact.before.asAmount(for: currency)
            let after = impact.after.asAmount(for: currency)
            ImpactBlock(
                title: missedMovement.map { AppLocale.string("Pointer \($0.name) règle l'écart") }
                    ?? AppLocale.string("Un ajustement règle l'écart"),
                before: nil,
                after: impact.after,
                currency: currency,
                note: adjustmentNote(
                    gap: signedGap, before: before, after: after, pointingSettles: missedMovement != nil
                ),
                showsFigures: false
            )
            .sensitiveAmount()
        case nil:
            EmptyView()
        }
    }

    /// What an adjustment would do to the disponible; pointing, by contrast, leaves it alone.
    private func adjustmentNote(gap: String, before: String, after: String, pointingSettles: Bool) -> String {
        guard pointingSettles else {
            return AppLocale.string("Un ajustement de \(gap) ferait passer ton disponible de \(before) à \(after).")
        }
        // swiftlint:disable:next line_length
        return AppLocale.string("Ton disponible ne bouge pas. Un ajustement de \(gap), lui, le ferait passer de \(before) à \(after).")
    }

    // MARK: - Footer

    @ViewBuilder
    private var footer: some View {
        let isBusy = month.hasPointingInFlight || isPointing
        VStack(spacing: DesignTokens.Spacing.sm) {
            switch verdict {
            case .upToDate:
                let canFinish = !isBusy
                    && flow.canConfirmUpToDate(realizedBalance: realizedBalance, of: month.budgetId)
                Button(AppLocale.string("Terminer"), action: finishUpToDate)
                    .disabled(!canFinish)
                    .primaryButtonStyle(isEnabled: canFinish)
                    .accessibilityIdentifier("reconcileFinishButton")
            case .adjustment:
                let canSubmit = !isBusy
                    && flow.canSubmitAdjustment(realizedBalance: realizedBalance, of: month.budgetId)
                if let missedMovement {
                    Button {
                        Task { await point(missedMovement) }
                    } label: {
                        Text("Pointer \(missedMovement.name)").lineLimit(1)
                    }
                    .disabled(isBusy || flow.isSubmitting)
                    .primaryButtonStyle(isEnabled: !isBusy && !flow.isSubmitting)
                    .accessibilityIdentifier("reconcilePointMissedButton")
                    Button(AppLocale.string("Enregistrer un ajustement")) {
                        Task { await submitAdjustment() }
                    }
                    .disabled(!canSubmit)
                    .tertiaryButtonStyle()
                    .accessibilityIdentifier("reconcileSubmitButton")
                } else {
                    Button {
                        Task { await submitAdjustment() }
                    } label: {
                        if flow.isSubmitting { ProgressView() } else { Text("Enregistrer un ajustement") }
                    }
                    .disabled(!canSubmit)
                    .primaryButtonStyle(isEnabled: canSubmit)
                    .accessibilityIdentifier("reconcileSubmitButton")
                }
            case nil:
                EmptyView()
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }

    // MARK: - Actions

    /// Pointing the movement moves the pointed balance by its amount: the gap closes and the
    /// sheet turns to « Terminer ». The disponible does not move.
    private func point(_ transaction: Transaction) async {
        isPointing = true
        defer { isPointing = false }
        let didSucceed = await checking.toggle(.transaction(transaction))
        if !didSucceed {
            toastManager.show(
                AppLocale.string("\(transaction.name) n'a pas pu être pointé — réessaie"),
                type: .error
            )
        }
    }

    /// A refusal keeps every input: one toast, then the same button retries.
    private func submitAdjustment() async {
        switch await flow.submitAdjustment(realizedBalance: realizedBalance, of: month.budgetId) {
        case .created:
            submitSuccessTrigger.toggle()
            toastManager.show(AppLocale.string("Ajustement enregistré"))
            dismiss()
        case .failed:
            toastManager.show(
                AppLocale.string("L'ajustement n'a pas pu être enregistré — réessaie"),
                type: .error
            )
        case .ignored:
            break
        }
    }

    private func finishUpToDate() {
        guard flow.confirmUpToDate(realizedBalance: realizedBalance, of: month.budgetId) else { return }
        submitSuccessTrigger.toggle()
        dismiss()
    }

    private func removeAccount(_ id: UUID) {
        focusedField = nil
        withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) { flow.removeAccount(id: id) }
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

#Preview("Comparer") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            ReconcileAccountsSheet(
                month: .init(
                    budgetId: "preview",
                    realizedMetrics: .init(
                        realizedIncome: 5200,
                        realizedExpenses: 2100.35,
                        realizedBalance: 3219.65,
                        checkedItemsCount: 12,
                        totalItemsCount: 18,
                        checkedSavingsAmount: 300
                    ),
                    rollover: 120
                ),
                checking: .init(
                    items: [], transactions: [], budgetLines: [],
                    syncingTransactionIds: [], syncingBudgetLineIds: [], toggle: { _ in false }
                ),
                onAdjustmentCreated: { _ in }
            )
            .environment(ToastManager())
            .environment(UserSettingsStore())
            .environment(AssetStore())
        }
}
