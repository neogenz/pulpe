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
    func firstComparisonActions(canFinish canKeep: Bool) -> some View {
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
            .foregroundStyle(Color.textSecondary)
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
