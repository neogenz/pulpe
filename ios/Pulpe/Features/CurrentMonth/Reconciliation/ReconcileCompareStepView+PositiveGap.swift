import SwiftUI

// MARK: - More on my accounts than in Pulpe

/// The screens that ask why my accounts hold more before any income is noted (spec.md §4.4), and the
/// money from before Pulpe, shown apart from the figure and corrected in its own sheet.
extension ReconcileCompareStepView {
    /// « Ces 3 100.00 CHF étaient là avant Pulpe ? »; hidden amounts keep the question without its amount.
    func firstComparisonCard(gap: Decimal) -> some View {
        let question = amountsHidden
            ? AppLocale.string("Cet argent était là avant Pulpe ?")
            : AppLocale.string("Ces \(gap.asInlineCurrency(currency)) étaient là avant Pulpe ?")
        return questionCard {
            Text(verbatim: question)
                .font(PulpeTypography.rowTitle)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
        }
        .accessibilityIdentifier("reconcileFirstComparison")
    }

    func salaryEarlyCard(nextPayDay: Int) -> some View {
        questionCard {
            Text("Ton salaire est arrivé en avance ?")
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
            Text(AppLocale.string("Reviens comparer le \(nextPayDay), jour de ta paie."))
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .accessibilityIdentifier("reconcileSalaryEarly")
    }

    /// A card paid but not yet billed is money still on the account: what I owe belongs in the list.
    var cardQuestion: some View {
        questionCard {
            Text("Tu as payé par carte de crédit, PayPal ou Klarna ?")
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Button(AppLocale.string("Ajouter ce que je dois")) { flow.addOwedRowFromComparison() }
                .secondaryButtonStyle(size: .small)
                .disabled(flow.isWriting || flow.isChecking)
                .accessibilityIdentifier("reconcileCardOwedButton")
        }
        .accessibilityIdentifier("reconcileCardQuestion")
    }

    private func questionCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let lines = content()
        return FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) { lines }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    /// The one write of a first comparison: the gap becomes money from before Pulpe, and « Disponible à
    /// dépenser » stays as it is.
    @ViewBuilder
    func firstComparisonActions(gap: Decimal, canFinish canKeep: Bool) -> some View {
        Button {
            Task { await keepGap() }
        } label: {
            if flow.isSavingState { ProgressView() } else { Text("Oui, c'était déjà là") }
        }
        .disabled(!canKeep)
        .primaryButtonStyle(isEnabled: canKeep)
        .accessibilityIdentifier("reconcileKeepStartButton")
        Text("Ton disponible ne change pas.")
            .font(PulpeTypography.captionRegular)
            .multilineTextAlignment(.center)
            .foregroundStyle(Color.textSecondary)
        reasonsButton(AppLocale.string("Non, autre chose"), gap: gap, from: .firstComparison, isEnabled: canKeep)
        leaveButton(AppLocale.string("Laisser comme ça"), isEnabled: canKeep)
    }

    /// « +3 100.00 CHF d'avant Pulpe » under the Pulpe figure: in ink like every amount, the pencil says it
    /// opens. Hidden amounts keep the words.
    func startingAmountLink(_ amount: Decimal) -> some View {
        let title = amountsHidden
            ? AppLocale.string("D'avant Pulpe")
            : AppLocale.string("\(signedCurrency(amount)) d'avant Pulpe")
        return Button { editsStartingAmount = true } label: {
            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(verbatim: title)
                    .font(PulpeTypography.captionRegular)
                    .monospacedDigit()
                    .foregroundStyle(Color.textSecondary)
                editPencil
            }
            .expandedTapArea()
        }
        .textLinkButtonStyle()
        .disabled(flow.isWriting || flow.isChecking)
        .frame(maxWidth: .infinity, alignment: isStacked ? .leading : .trailing)
        .padding(.bottom, DesignTokens.Spacing.md)
        .accessibilityIdentifier("reconcileStartingAmountButton")
    }

    /// Coming back on pay day is the answer, so leaving is the main action; the other causes stay one tap away.
    @ViewBuilder
    func salaryEarlyActions(gap: Decimal, canFinish: Bool) -> some View {
        Button(AppLocale.string("Laisser comme ça"), action: finish)
            .disabled(!canFinish)
            .primaryButtonStyle(isEnabled: canFinish)
            .accessibilityIdentifier("reconcileLeaveButton")
        reasonsButton(AppLocale.string("Voir les autres raisons"), gap: gap, from: .salaryEarly, isEnabled: canFinish)
    }

    // MARK: - Other reasons

    /// The gap and screen the sheet opened on, handed to it as its item: a sheet built from separate
    /// state could show the values of an earlier body (0.00 CHF on its first opening).
    struct ReasonsRequest: Identifiable {
        let id = UUID()
        let gap: Decimal
        let screen: AccountReconciliation.Screen
    }

    func reasonsButton(
        _ title: String, gap: Decimal, from screen: AccountReconciliation.Screen, isEnabled: Bool
    ) -> some View {
        Button(title) { reasons = ReasonsRequest(gap: gap, screen: screen) }
            .disabled(!isEnabled)
            .secondaryButtonStyle()
            .accessibilityIdentifier("reconcileReasonsButton")
    }

    func reasonsSheet(_ request: ReasonsRequest) -> some View {
        let partly = AccountReconciliation.partlySpentBudgetLines(
            lines: checking.budgetLines, transactions: checking.transactions
        ).first
        let line = partly.flatMap { partly in checking.budgetLines.first { $0.id == partly.id } }
        return ReconcileReasonsSheet(
            gap: request.gap, currency: currency, hasOwedRow: flow.hasOwedRow,
            partlySpent: partly.flatMap { partly in
                line.map { .init(name: $0.name, amount: $0.amount, spent: partly.spent, left: partly.left) }
            },
            note: AccountReconciliation.availableAfterNote(available: month.available, gap: request.gap)
        ) { reasonAnswer = ($0, request) }
    }

    /// Once the sheet is gone: closing the comparison under a sheet still on screen would leave it behind.
    func actOnReason() {
        guard let answer = reasonAnswer else { return }
        reasonAnswer = nil
        switch answer.choice {
        case .addOwe: flow.addOwedRowFromComparison()
        case .reviewAccounts: flow.editAccounts()
        case .leave: finish()
        case .noteIncome:
            isTitleFocused = true
            let current = flow.comparison(
                realizedBalance: realizedBalance, lines: checking.budgetLines, transactions: checking.transactions,
                payDayOfMonth: userSettingsStore.payDayOfMonth
            )
            Task {
                report(entry: await flow.submitReasonIncome(
                    gap: answer.request.gap, screen: answer.request.screen, current: current,
                    realizedBalance: realizedBalance, of: month.budgetId
                ))
            }
        }
    }

    // MARK: - Writes

    /// Refused, the screen stays as it was and one toast says so; written, VoiceOver starts again from
    /// the title, which now says what the figures do.
    func keepGap() async {
        report(await flow.keepGapAsStartingAmount(realizedBalance: realizedBalance, of: month.budgetId))
    }

    func saveStartingAmount(_ amount: Decimal) async {
        report(await flow.saveStartingAmount(amount))
    }

    private func report(_ outcome: ReconcileAccountsFlow.SubmitOutcome) {
        switch outcome {
        case .written:
            submitSuccessTrigger.toggle()
            isTitleFocused = true
        case .failed:
            toastManager.show(AppLocale.string("La modification a échoué — réessaie"), type: .error)
        case .ignored:
            break
        }
    }
}
