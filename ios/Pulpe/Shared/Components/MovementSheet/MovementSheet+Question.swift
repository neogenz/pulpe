import SwiftUI

/// "C'était prévu dans ton budget ?": which prévision the movement belongs to, and what that
/// does to the disponible. Split out of the sheet to keep it readable; the state it reads is
/// declared non-private on the sheet for this reason.
extension MovementSheet {
    // MARK: - Which prévision

    /// The prévision the movement will be written under. Savings drawn from a goal are free
    /// by backend rule, so they never carry one. Untouched, the answer is « imprévu »: the
    /// suggested prévision is offered as the first chip, never picked for the user.
    var selectedLineId: String? {
        if let tx = context.editing { return tx.budgetLineId }
        if savingsOriginRule.isOffered && isFromSavings { return nil }
        if case .line(let id) = linePick { return id }
        return nil
    }

    var selectedLine: BudgetLine? {
        guard let id = selectedLineId else { return nil }
        return context.budgetLines.first { $0.id == id }
    }

    var suggestedLine: BudgetLine? {
        MovementLineChoices.suggested(
            lines: context.budgetLines,
            transactions: context.transactions,
            kind: kind,
            name: name
        )
    }

    var hasEligibleLines: Bool {
        !MovementLineChoices.eligible(lines: context.budgetLines, kind: kind).isEmpty
    }

    /// True once the answer cannot be changed here: an edit (the PATCH has no prévision), or
    /// savings drawn from a goal.
    var isQuestionLocked: Bool {
        isEditing || (savingsOriginRule.isOffered && isFromSavings) || realization != nil
    }

    var availableOnSelectedLine: Decimal? {
        selectedLine.map {
            BudgetFormulas.calculateConsumption(for: $0, transactions: context.transactions).available
        }
    }

    // MARK: - Question

    @ViewBuilder
    var lineQuestion: some View {
        if hasEligibleLines || selectedLine != nil || isEditing {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("C'était prévu dans ton budget ?")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.leading, DesignTokens.Spacing.xs)

                ChipFlowLayout {
                    if let line = shownLine {
                        Button { pick(.line(line.id)) } label: {
                            lineChip(line, isSelected: selectedLineId == line.id)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selectedLineId == line.id ? .isSelected : [])
                    }
                    if hasEligibleLines, !isEditing {
                        Button { showsLinePicker = true } label: {
                            PulpeChip(label: AppLocale.string("Autre"), trailing: {
                                Image(systemName: "chevron.right")
                                    .font(PulpeTypography.metricMini)
                            })
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("movementOtherLine")
                    }
                    Button { pick(.unplanned) } label: {
                        PulpeChip(
                            label: PendingWording.unplannedAnswer,
                            style: selectedLineId == nil ? .selected : .outlined
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selectedLineId == nil ? .isSelected : [])
                    .accessibilityIdentifier("movementUnplanned")
                }
                .disabled(isQuestionLocked)
                .opacity(isQuestionLocked && !isEditing ? DesignTokens.Opacity.disabled : 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The first chip: the user's own pick, else the suggestion. An edit shows its current line.
    private var shownLine: BudgetLine? {
        if isEditing { return selectedLine }
        if case .line(let id) = linePick { return context.budgetLines.first { $0.id == id } }
        return suggestedLine
    }

    private func lineChip(_ line: BudgetLine, isSelected: Bool) -> some View {
        let left = BudgetFormulas.calculateConsumption(for: line, transactions: context.transactions).available
        let currency = userSettingsStore.currency
        return PulpeChip(
            label: line.name,
            style: isSelected ? .selected : .outlined,
            trailing: {
                Text(AppLocale.string("reste \(max(left, 0).asCompactAmount(for: currency))"))
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
            }
        )
    }

    func pick(_ answer: LinePick) {
        withAnimation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut) { linePick = answer }
    }

    // MARK: - Impact

    /// The typed amount in the account currency, once it is known.
    private var amountInAccountCurrency: Decimal? {
        guard let amount, amount > 0 else { return nil }
        return inputCurrency == userSettingsStore.currency ? amount : convertedAmount
    }

    var impact: MovementImpact? {
        guard let value = amountInAccountCurrency else { return nil }
        let isUnchanged = context.editing.map {
            $0.amount == value && $0.kind == kind
        } ?? false
        guard !isUnchanged else { return nil }
        return MovementImpact.compute(
            lines: context.budgetLines,
            transactions: context.transactions,
            rollover: context.rollover,
            replacing: context.editing?.id,
            draft: MovementImpact.Draft(kind: kind, amount: value, lineId: selectedLineId)
        )
    }

    @ViewBuilder
    var impactBlock: some View {
        if !routesToWithdrawal, let impact {
            let currency = userSettingsStore.currency
            ImpactBlock(
                title: impact.title(currency: currency),
                before: impact.before,
                after: impact.after,
                currency: currency,
                note: impactNote(impact),
                tone: impact.tone == .over ? .over : (impact.tone == .ok ? .ok : .neutral),
                showsFigures: impact.tone != .neutral
            )
            .transition(.revealBelowTrigger)
        }
    }

    private func impactNote(_ impact: MovementImpact) -> String? {
        let currency = userSettingsStore.currency
        if let line = selectedLine, let before = impact.lineBefore, let after = impact.lineAfter {
            let beforeText = max(before, 0).asAmount(for: currency)
            let afterText = max(after, 0).asAmount(for: currency)
            if impact.tone == .neutral {
                return AppLocale.string(
                    "C'était prévu dans \(line.name) : il y reste \(afterText) au lieu de \(beforeText)."
                )
            }
            if impact.tone == .over {
                return AppLocale.string("\(line.name) est dépassée : le surplus sort de ton disponible.")
            }
            return nil
        }
        if impact.tone == .over { return AppLocale.string("Aucune prévision ne la couvre.") }
        if savingsOriginRule.isActive, let goalId = savingsGoalId,
           let goal = savingsGoalStore.goals.first(where: { $0.id == goalId }) {
            return AppLocale.string("Retiré de \(goal.name).")
        }
        return nil
    }

    // MARK: - Pushed list

    var linePickerPage: some View {
        MovementLinePicker(
            sections: MovementLineChoices.sections(
                lines: context.budgetLines, transactions: context.transactions, kind: kind
            ),
            transactions: context.transactions,
            kind: kind,
            currency: userSettingsStore.currency,
            selectedLineId: selectedLineId
        ) { answer in
            pick(answer)
            showsLinePicker = false
        }
    }
}
