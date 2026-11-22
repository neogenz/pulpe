import SwiftUI

/// Step 2 of « Comparer avec mes comptes » (spec.md §4): the two figures, the verdict as title, then
/// one way to deal with the gap. Every figure is read from `flow.comparison` on each render, so a
/// check, a removed row or a refreshed context moves the screen at once.
struct ReconcileCompareStepView: View {
    typealias Suggestion = ReconcileAccountsFlow.Suggestion

    let flow: ReconcileAccountsFlow
    let month: ReconcileAccountsSheet.Month
    let checking: ReconciliationChecking
    let currency: SupportedCurrency

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(ToastManager.self) var toastManager
    @Environment(UserSettingsStore.self) var userSettingsStore
    @State var submitSuccessTrigger = false
    @State var editsStartingAmount = false
    /// What « Voir les autres raisons » opened on, and what that sheet answered once closed.
    @State var reasons: ReasonsRequest?
    @State var reasonAnswer: (choice: ReconcileReasonsSheet.Choice, request: ReasonsRequest)?
    /// Back on the title after a write that moved the figures.
    @AccessibilityFocusState var isTitleFocused: Bool
    /// The month's items as « Voir les … autres » opened them: a row I check there stays checked until I go back.
    @State private var toCheck: [Suggestion] = []
    @State private var showsToCheck = false

    var realizedBalance: Decimal { month.realizedMetrics.realizedBalance }
    var isStacked: Bool { dynamicTypeSize.isAccessibilitySize }

    var body: some View {
        Group {
            switch flow.contextState {
            case .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed:
                failure
            case .loaded:
                if let comparison = flow.comparison(
                    realizedBalance: realizedBalance, lines: checking.budgetLines, transactions: checking.transactions,
                    payDayOfMonth: userSettingsStore.payDayOfMonth
                ) {
                    content(comparison)
                }
            }
        }
        .background(Color.sheetBackground)
        .task { if flow.context == nil { await flow.loadContext() } }
        .navigationDestination(isPresented: $showsToCheck) { toCheckList }
        .sheet(item: $reasons, onDismiss: actOnReason) { reasonsSheet($0) }
        .sheet(isPresented: $editsStartingAmount) {
            ReconcileStartingAmountSheet(amount: flow.context?.startingAmount ?? 0, currency: currency) { amount in
                Task { await saveStartingAmount(amount) }
            }
        }
        .onChange(of: flow.closesToCheckList(realizedBalance: realizedBalance)) { _, closes in
            if closes { showsToCheck = false }
        }
        // The comparison closes under the sheets it opened: they go with it.
        .onChange(of: flow.shouldClose(loadedBudgetId: month.budgetId)) { _, closes in
            if closes { reasons = nil; editsStartingAmount = false }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    private func content(_ comparison: ReconcileAccountsFlow.Comparison) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                header(comparison.gap)
                // Once they match, the title says it all: the card below explains the rest.
                if comparison.screen != .matched { figures(comparison) }
                switch comparison.screen {
                case .matched: matchedCard(comparison)
                case .suggestions: suggestions(comparison)
                case .smallGap: smallGapCard(gap: comparison.gap)
                case .firstComparison: firstComparisonCard(gap: comparison.gap)
                case .salaryEarly: salaryEarlyCard(nextPayDay: comparison.nextPayDay)
                case .moreOnAccounts where !flow.hasOwedRow: cardQuestion
                default: EmptyView()
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.xl)
            .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: comparison.screen)
            // At accessibility sizes the actions scroll with the figures: pinned, they would leave no room for them.
            if isStacked { footer(comparison) }
        }
        .scrollBounceBehavior(.basedOnSize)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { if !isStacked { footer(comparison) } }
    }

    /// The context could not be read: no figure, nothing to write, and the back arrow keeps step 1.
    private var failure: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            stepLabel
            InfoBanner(
                .err, systemImage: "exclamationmark.circle",
                text: AppLocale.string("Impossible de comparer pour l'instant.")
            )
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) {
            Button(AppLocale.string("Réessayer")) { Task { await flow.loadContext() } }
                .primaryButtonStyle()
                .accessibilityIdentifier("reconcileRetryButton")
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.md)
        }
    }

    // MARK: - Header and figures

    private var stepLabel: some View {
        Text("Étape 2 sur 2")
            .font(PulpeTypography.metricLabel)
            .foregroundStyle(Color.textSecondary)
    }

    private func header(_ gap: Decimal) -> some View {
        let amount = gap.absoluteValue.asInlineCurrency(currency)
        // Hidden amounts keep the verdict in words: a blurred title says nothing at all.
        let title = gap == 0 ? AppLocale.string("Pareil des deux côtés")
            : amountsHidden ? (gap < 0 ? AppLocale.string("Tes comptes ont moins d'argent que Pulpe")
                : AppLocale.string("Tes comptes ont plus d'argent que Pulpe"))
            : gap < 0 ? AppLocale.string("Tes comptes ont \(amount) de moins que Pulpe")
            : AppLocale.string("Tes comptes ont \(amount) de plus que Pulpe")
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            stepLabel
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                if gap == 0 {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.pulpePrimary)
                        .accessibilityHidden(true)
                }
                Text(verbatim: title)
                    .font(PulpeTypography.stepTitle)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($isTitleFocused)
                    .accessibilityIdentifier("reconcileVerdict")
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func figures(_ comparison: ReconcileAccountsFlow.Comparison) -> some View {
        FormCard {
            figureRow(AppLocale.string("Sur tes comptes")) {
                Text(verbatim: comparison.accounts.asCurrency(currency))
            }
            FormRowDivider()
            figureRow(AppLocale.string("Dans Pulpe, déjà coché")) {
                // The Accueil's « Solde pointé »; what else Pulpe counts shows apart, on the lines below.
                let now = comparison.realized.asCurrency(currency)
                let before = comparison.realizedBefore?.asCurrency(currency)
                VStack(alignment: isStacked ? .leading : .trailing, spacing: DesignTokens.Spacing.xxs) {
                    if let before {
                        Text(verbatim: before)
                            .strikethrough(true, color: Color.textTertiary)
                            .foregroundStyle(Color.textTertiary)
                    }
                    Text(verbatim: now)
                }
                // Read as « 2'052.69 CHF, avant 2'092.69 CHF »: a strikethrough is silent to VoiceOver.
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(before.map { AppLocale.string("\(now), avant \($0)") } ?? now)
            }
            .accessibilityIdentifier("reconcileComparedFigure")
            figureParts(comparison)
            if let found = comparison.found, found > 0 {
                FormRowDivider()
                foundBar(found: found, gap: comparison.gap)
            }
        }
    }

    /// Stacked at accessibility sizes, so a label never pushes its amount onto two lines.
    func figureRow<Amount: View>(
        _ title: String, tint: Color = .textPrimary, isEditable: Bool = false, @ViewBuilder amount: () -> Amount
    ) -> some View {
        let layout = isStacked
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: DesignTokens.Spacing.xs))
            : AnyLayout(HStackLayout(spacing: DesignTokens.Spacing.md))
        return layout {
            Text(title)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: DesignTokens.Spacing.xs) {
                amount()
                    .font(PulpeTypography.rowAmount)
                    .monospacedDigit()
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
                    .sensitiveAmount()
                // Outside the blur: with amounts hidden, the row still says it opens.
                if isEditable { editPencil }
            }
            .layoutPriority(1)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Screens

extension ReconcileCompareStepView {
    private func suggestions(_ comparison: ReconcileAccountsFlow.Comparison) -> some View {
        // A checked row leaves: the bar and the struck figure carry what it found.
        let rows = comparison.suggestions
        let shown = Set(rows.map(\.id))
        let others = checking.items.filter { item in
            // A planned savings withdrawal is realized by its real income: the API refuses to check it.
            if case .budgetLine(let line, _) = item, line.isPlannedSavingsWithdrawal { return false }
            return !shown.contains(item.id)
        }
        let lead = Self.suggestionsWording(comparison, hasOwedRow: flow.hasOwedRow).lead
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text(verbatim: lead)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            suggestionCard(rows)
            if !others.isEmpty {
                Button {
                    toCheck = others.map(Suggestion.init)
                    showsToCheck = true
                } label: {
                    Text(AppLocale.string("Voir les \(others.count) autres à cocher"))
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.pulpePrimary)
                        .expandedTapArea()
                }
                .textLinkButtonStyle()
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .accessibilityIdentifier("reconcileSeeOthers")
            }
            if comparison.gap < 0, flow.hasOwedRow { owedBox }
        }
    }

    private func suggestionCard(_ rows: [Suggestion]) -> some View {
        FormCard {
            ForEach(rows) { suggestion in
                suggestionRow(suggestion)
                if suggestion.id != rows.last?.id { FormRowDivider() }
            }
        }
    }

    private func suggestionRow(_ suggestion: Suggestion) -> some View {
        let isChecked = flow.checkedSuggestions.contains { $0.id == suggestion.id }
        let isHighlighted = suggestion.isExact && !isChecked
        let layout = isStacked
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: DesignTokens.Spacing.xs))
            : AnyLayout(HStackLayout(spacing: DesignTokens.Spacing.md))
        return HStack(spacing: DesignTokens.Spacing.md) {
            // Pulpe never unchecks: a row checked here stays checked.
            // The circle fills before the request leaves: the exits wait from the tap on.
            PointCircle(
                isPointed: isChecked, isSyncing: flow.isChecking,
                onPrepareToggle: { flow.beginCheck() }, onToggle: { Task { await check(suggestion) } }
            )
            .disabled(isChecked || month.hasPointingInFlight)
            .accessibilityLabel(
                isChecked
                    ? AppLocale.string("\(suggestion.name), pointé") : AppLocale.string("Pointer \(suggestion.name)")
            )
            layout {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(suggestion.name)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(isStacked ? nil : 2)
                    Text(verbatim: origin(of: suggestion))
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(verbatim: suggestion.amount.asCurrency(currency))
                    .font(PulpeTypography.rowAmount)
                    .monospacedDigit()
                    .lineLimit(1)
                    .foregroundStyle(isHighlighted ? Color.accentInk : Color.textPrimary)
                    .padding(.horizontal, isHighlighted ? DesignTokens.Spacing.sm : DesignTokens.Spacing.none)
                    .background(
                        isHighlighted ? Color.accentWash : Color.clear,
                        in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                    )
                    .accessibilityValue(isHighlighted ? AppLocale.string("Même montant que l'écart") : "")
                    .sensitiveAmount()
            }
        }
        .frame(minHeight: DesignTokens.ListRow.suggestionMinHeight)
        .accessibilityIdentifier("reconcileSuggestion")
    }

    private func origin(of suggestion: Suggestion) -> String {
        switch suggestion.origin {
        case .plannedThisMonth: AppLocale.string("Prévue ce mois")
        case .date(let date): date.relativeFormatted
        }
    }

    private var toCheckList: some View {
        ScrollView {
            suggestionCard(toCheck)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .background(Color.sheetBackground)
        .navigationTitle(AppLocale.string("À pointer"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Footer and actions

extension ReconcileCompareStepView {
    @ViewBuilder
    private func footer(_ comparison: ReconcileAccountsFlow.Comparison) -> some View {
        let canFinish = !month.hasPointingInFlight && flow.canFinish(of: month.budgetId)
        let gap = comparison.gap
        VStack(spacing: DesignTokens.Spacing.sm) {
            switch comparison.screen {
            case .matched:
                Button(AppLocale.string("Terminer"), action: finish)
                    .disabled(!canFinish)
                    .primaryButtonStyle(isEnabled: canFinish)
                    .accessibilityIdentifier("reconcileFinishButton")
            case .suggestions:
                Button(Self.suggestionsWording(comparison, hasOwedRow: flow.hasOwedRow).dismiss) {
                    withAnimation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut) {
                        flow.dismissSuggestions()
                    }
                }
                .disabled(flow.isChecking)
                .secondaryButtonStyle()
                .accessibilityIdentifier("reconcileDismissSuggestions")
                leaveButton(AppLocale.string("Laisser comme ça"), isEnabled: canFinish)
            case .firstComparison:
                firstComparisonActions(gap: gap, canFinish: canFinish)
            case .salaryEarly:
                salaryEarlyActions(gap: gap, canFinish: canFinish)
            case .smallGap:
                entryButton(gap: gap, answersYes: false)
                availableNote(gap: gap)
                leaveButton(AppLocale.string("Laisser comme ça"), isEnabled: canFinish)
            default:
                // Writing waits for a yes: is the line really in the banking app?
                Text(verbatim: largeGapQuestion(gap: gap))
                    .font(PulpeTypography.rowTitle)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                entryButton(gap: gap, answersYes: true)
                availableNote(gap: gap)
                Button(AppLocale.string("Non, laisser comme ça"), action: finish)
                    .disabled(!canFinish)
                    .secondaryButtonStyle()
                    .accessibilityIdentifier("reconcileLeaveButton")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }

    /// Hidden amounts keep the question the « Oui » answers, without its amount.
    private func largeGapQuestion(gap: Decimal) -> String {
        guard !amountsHidden else {
            return gap < 0
                ? AppLocale.string("Tu vois une dépense dans l'app de ta banque, mais pas dans Pulpe ?")
                : AppLocale.string("Tu vois un revenu dans l'app de ta banque, mais pas dans Pulpe ?")
        }
        let signed = signedCurrency(gap)
        return AppLocale.string("Tu vois \(signed) dans l'app de ta banque, mais pas dans Pulpe ?")
    }

    func leaveButton(_ title: String, isEnabled: Bool) -> some View {
        Button(title, action: finish)
            .disabled(!isEnabled)
            .tertiaryButtonStyle()
            .accessibilityIdentifier("reconcileLeaveButton")
    }

    /// The one write: its name is said only once it is noted.
    private func entryButton(gap: Decimal, answersYes: Bool) -> some View {
        let amount = gap.absoluteValue.asInlineCurrency(currency)
        // Hidden amounts leave the action readable: the label drops its amount instead of blurring.
        let title = if amountsHidden {
            switch (gap < 0, answersYes) {
            case (true, false): AppLocale.string("Noter une dépense")
            case (false, false): AppLocale.string("Noter un revenu")
            case (true, true): AppLocale.string("Oui, noter une dépense")
            case (false, true): AppLocale.string("Oui, noter un revenu")
            }
        } else {
            switch (gap < 0, answersYes) {
            case (true, false): AppLocale.string("Noter une dépense de \(amount)")
            case (false, false): AppLocale.string("Noter un revenu de \(amount)")
            case (true, true): AppLocale.string("Oui, noter une dépense de \(amount)")
            case (false, true): AppLocale.string("Oui, noter un revenu de \(amount)")
            }
        }
        let canWrite = !month.hasPointingInFlight
            && flow.canSubmitAdjustment(realizedBalance: realizedBalance, of: month.budgetId)
        return Button {
            Task { await submitEntry() }
        } label: {
            if flow.isSubmitting {
                ProgressView()
            } else {
                // At accessibility sizes the label wraps: shrunk to one line, the amount is what gets cut.
                Text(verbatim: title).monospacedDigit().lineLimit(isStacked ? nil : 1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
            }
        }
        .disabled(!canWrite)
        .primaryButtonStyle(isEnabled: canWrite)
        .accessibilityIdentifier("reconcileSubmitButton")
    }

    private func availableNote(gap: Decimal) -> some View {
        let note = AccountReconciliation.availableAfterNote(available: month.available, gap: gap)
        let before = note.before.asInlineCurrency(currency), after = note.after.asInlineCurrency(currency)
        return Text(AppLocale.string("Disponible : \(before) → \(after)"))
            .font(PulpeTypography.captionRegular)
            .multilineTextAlignment(.center)
            .monospacedDigit()
            .foregroundStyle(Color.textSecondary)
            .sensitiveAmount()
            .accessibilityIdentifier("reconcileAvailableNote")
    }

    private func check(_ suggestion: Suggestion) async {
        _ = await flow.check(suggestion, realizedBalance: realizedBalance) {
            let didCheck = await checking.check(suggestion.target)
            if !didCheck {
                let message = AppLocale.string("\(suggestion.name) n'a pas pu être pointé — réessaie")
                toastManager.show(message, type: .error)
            }
            return didCheck
        }
    }

    /// A refusal keeps everything: one toast, then the same button retries.
    private func submitEntry() async {
        report(entry: await flow.submitAdjustment(realizedBalance: realizedBalance, of: month.budgetId))
    }

    func report(entry outcome: ReconcileAccountsFlow.SubmitOutcome) {
        switch outcome {
        case .written:
            submitSuccessTrigger.toggle()
            toastManager.show(AppLocale.string("« Écart avec mes comptes » noté"))
            dismiss()
        case .failed:
            toastManager.show(AppLocale.string("L'ajout a échoué — réessaie"), type: .error)
        case .ignored:
            break
        }
    }

    func finish() {
        guard flow.finishWithoutEntry(of: month.budgetId) else { return }
        submitSuccessTrigger.toggle()
        dismiss()
    }
}
