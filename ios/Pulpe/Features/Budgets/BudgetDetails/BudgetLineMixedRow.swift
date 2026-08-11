import SwiftUI

/// Mixed-list budget card. Standard sizes keep the compact amount column;
/// Accessibility sizes move amount and chevron below the descriptive content.
/// The point circle remains independently actionable from the card surface.
struct BudgetLineMixedRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let isSyncing: Bool
    /// Primitive value avoids observing the full user-settings store.
    let currency: SupportedCurrency
    /// Pre-resolved goal name; the row never reads `SavingsGoalStore`.
    let savingsGoalName: String?
    let tagNames: [String]
    /// Pre-resolved origin month for a savings-withdrawal repayment.
    var savingsWithdrawalOriginMonthName: String?
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var triggerToggleFeedback = false

    // MARK: - Derived values

    // Internal rather than private: `BudgetLineMixedRow+Amount.swift` reads the
    // same vocabulary, and Swift scopes `private` to the file.

    /// `consumption.allocated` — sum of linked transactions on this line.
    var realAmount: Decimal { consumption.allocated }
    /// `line.amount` — what the user planned for this envelope.
    var plannedAmount: Decimal { line.amount }
    var hasReal: Bool { realAmount > 0 }
    /// Equivalent of `e.real > e.planned` in the spec; matches `consumption.isOverBudget`.
    var isOverBudget: Bool { consumption.isOverBudget }

    private var isPointed: Bool { line.isChecked }
    var isIncome: Bool { line.kind == .income }
    var isSaving: Bool { line.kind == .saving }
    var isExpense: Bool { line.kind == .expense }

    /// Every contextual fact about the line on one line. A withdrawal income can
    /// never also be spread or carry a goal (both are saving-only), so they
    /// share a single slot instead of stacking one badge per fact.
    static func metadataText(
        isSpread: Bool,
        savingsGoalName: String?,
        isSavingsWithdrawalIncome: Bool,
        savingsGoalSource: SavingsGoalSource? = nil
    ) -> String? {
        var parts: [String] = []
        if isSpread { parts.append("Lissé") }
        if let savingsGoalName { parts.append("objectif \(savingsGoalName)") }
        if isSavingsWithdrawalIncome { parts.append("Pris sur ton épargne") }
        // PUL-329 v2 — the goal this announced withdrawal draws from. Keeps its
        // own snapshot wording once the goal is deleted: history, not an error.
        if let savingsGoalSource { parts.append(savingsGoalSource.label) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// Resolved once so the row body and the VoiceOver label can never drift apart.
    private var metadata: String? {
        Self.metadataText(
            isSpread: line.isSpread,
            savingsGoalName: savingsGoalName,
            isSavingsWithdrawalIncome: line.isSavingsWithdrawalIncome,
            savingsGoalSource: line.savingsGoalSource
        )
    }

    static func realizationLabel(
        for line: BudgetLine,
        realizedAmount: Decimal
    ) -> String? {
        guard line.isPlannedSavingsWithdrawal, realizedAmount < line.amount else { return nil }
        return realizedAmount > 0 ? "Réaliser le solde" : "Réaliser ce retrait"
    }

    private var realizationLabel: String? {
        Self.realizationLabel(for: line, realizedAmount: realAmount)
    }

    /// PointCircle dot color — kind-based. The overflow override only applies to
    /// expenses; income / saving keep their category color even when the actual
    /// amount overshoots the plan (a positive surprise, not a deficit).
    private var dotColor: Color {
        if isIncome { return .financialIncome }
        if isSaving { return .financialSavings }
        if isOverBudget { return .financialOverBudget }
        return .financialExpense
    }

    // MARK: - Body

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                // The leading rail belongs to the row, not to the circle. An
                // announced withdrawal has nothing to point, and dropping the
                // slot along with the circle starts its title 44pt left of every
                // neighbour — `ios/DESIGN.md` sizes the row's `xs` leading
                // padding against this slot, not against the card edge.
                Group {
                    if line.isPlannedSavingsWithdrawal {
                        Color.clear
                    } else {
                        PointCircle(
                            isPointed: isPointed,
                            color: dotColor,
                            isSyncing: isSyncing,
                            onToggle: handleTogglePointed
                        )
                    }
                }
                .frame(width: DesignTokens.TapTarget.minimum)

                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        centerColumn
                        HStack {
                            Spacer(minLength: DesignTokens.Spacing.none)
                            amountColumn
                            chevron
                        }
                    }
                } else {
                    centerColumn
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    amountColumn
                    chevron
                }
            }
            .padding(.vertical, DesignTokens.Spacing.md)
            .padding(.leading, DesignTokens.Spacing.xs)
            .padding(.trailing, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
            .opacity(isPointed ? DesignTokens.Opacity.pointedDim : 1)
            .animation(
                reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                value: isPointed
            )
        }
        .buttonStyle(.plain)
        .pulpeRowCard(cornerRadius: DesignTokens.CornerRadius.xl)
        .sensoryFeedback(.success, trigger: triggerToggleFeedback)
        // `.contain` keeps the inner PointCircle as its own focus node so VoiceOver
        // can drive the pointed/unpointed toggle independently of the row's tap-to-open.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Touche pour ouvrir le détail")
        .accessibilityIdentifier("budgetLineMixedRow-\(line.id)")
    }

    // MARK: - Center column (kind tag + label + subtitle)

    @ViewBuilder
    private var centerColumn: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            KindTagInline(kind: line.kind)

            Text(line.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
                .strikethrough(isPointed, color: Color.textTertiary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                .truncationMode(.tail)

            metadataRow

            subtitleView
                .font(PulpeTypography.metricLabelBold)
                .lineLimit(1)
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Every secondary fact about the line — provenance, lissage, objectif, tag
    /// count — on one tertiary line. Stacking one badge per fact pushed the row
    /// to five lines and knocked the amount column out of vertical alignment.
    @ViewBuilder
    private var metadataRow: some View {
        if metadata != nil || !tagNames.isEmpty {
            HStack(spacing: DesignTokens.Spacing.xs) {
                if line.isSavingsWithdrawalIncome {
                    // Decorative: `metadata` already carries "Pris sur ton épargne",
                    // and the row is an accessibility container, so an unhidden symbol
                    // would offer its SF name as a second reading of the same fact.
                    Image(systemName: TransactionKind.savingsIcon)
                        .accessibilityHidden(true)
                }

                if let metadata {
                    Text(metadata)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                        .truncationMode(.tail)
                }

                if !tagNames.isEmpty {
                    TagChips(
                        names: tagNames,
                        presentation: .count,
                        followsText: metadata != nil
                    )
                }
            }
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textTertiary)
        }
    }

    /// Spec §08 — subtitle rules. Empty when pointed, or for partial/empty
    /// expenses where the hero already carries the remaining amount.
    @ViewBuilder
    private var subtitleView: some View {
        if isPointed {
            EmptyView()
        } else if isIncome {
            incomeSubtitle
        } else if isSaving {
            savingSubtitle
        } else if isOverBudget {
            overBudgetSubtitle
        } else {
            EmptyView()
        }
    }

    // Income: "Reçu" once fully covered, "X.XX CHF à recevoir" only on partial
    // (the right hero already carries `prévu` when nothing has been received).
    @ViewBuilder
    private var incomeSubtitle: some View {
        if hasReal && realAmount >= plannedAmount {
            Text("Reçu")
                .foregroundStyle(Color.textTertiary)
        } else if hasReal {
            let remaining = plannedAmount - realAmount
            Text("\(remaining.asCurrency(currency)) à recevoir")
                .foregroundStyle(Color.textTertiary)
        }
    }

    // Saving: "Transféré" once fully covered, "X.XX CHF à transférer" only on
    // partial. When nothing has been transferred yet the hero already shows the
    // planned amount; repeating it as a subtitle would be redundant. A savings
    // withdrawal repayment (PUL-292) adds "pris en {mois}" as a COMPLEMENT — the
    // The "à transférer / Transféré" status line always remains.
    @ViewBuilder
    private var savingSubtitle: some View {
        let showTransferred = hasReal && realAmount >= plannedAmount
        let showRemaining = hasReal && realAmount < plannedAmount
        let showOrigin = savingsWithdrawalOriginMonthName != nil && line.savingsWithdrawalGroupId != nil
        if showTransferred || showRemaining || showOrigin {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                if showTransferred {
                    Text("Transféré")
                        .foregroundStyle(Color.textTertiary)
                } else if showRemaining {
                    Text("\((plannedAmount - realAmount).asCurrency(currency)) à transférer")
                        .foregroundStyle(Color.textTertiary)
                }
                if showOrigin, let originName = savingsWithdrawalOriginMonthName {
                    Text("pris en \(originName)")
                        .foregroundStyle(Color.textTertiary)
                }
            }
        }
    }

    // Expense overflow: "Budget dépassé" in the warm overflow color.
    // The excess amount lives on the right hero with the "de dépassement" suffix.
    @ViewBuilder
    private var overBudgetSubtitle: some View {
        Text("Budget dépassé")
            .foregroundStyle(Color.financialOverBudget)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Color.textTertiary)
            .padding(.leading, DesignTokens.Spacing.xs)
            .accessibilityHidden(true)
    }

    // MARK: - Actions

    private func handleTap() {
        guard !line.isVirtualRollover else { return }
        onTap()
    }

    private func handleTogglePointed() {
        guard !line.isVirtualRollover else { return }
        triggerToggleFeedback.toggle()
        onTogglePointed()
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        let kindWord = line.kind.label
        // An announced withdrawal is realized, not pointed. Either way the row
        // speaks its state, never its action: realizing one happens on the line's
        // own screen, so naming the verb here would announce a button that the
        // row does not carry.
        let status = line.isPlannedSavingsWithdrawal
            ? (realizationLabel == nil ? "Réalisé" : "À réaliser")
            : (isPointed ? "Pointé" : "À pointer")
        let amount = displayAmount.asCurrency(currency)
        let tags = tagNames.isEmpty ? "" : " · Tags : \(tagNames.joined(separator: ", "))"
        let context = metadata.map { " · \($0)" } ?? ""
        return "\(kindWord) · \(line.name)\(context) · \(amount) · \(status)\(tags)"
    }
}
