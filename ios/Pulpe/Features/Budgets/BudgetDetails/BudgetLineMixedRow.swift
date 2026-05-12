import SwiftUI

/// Per-row mixed-list card for the budget detail screen (DM2.1.b.c5).
///
/// Surface card displaying one budget line in the mixed (income / saving / expense)
/// flow. Replaces the `BudgetLineRow` Revolut-style row inside `BudgetDetailsView`.
///
/// Layout:
///
///     [PointCircle]  KIND TAG
///                    Label                        Amount CHF   [chev]
///                    Subtitle                     / X prévu
///
/// Tap on the circle toggles `isChecked` (`onTogglePointed`); tap on the row
/// surface opens the `BudgetLineDetailSheet` (`onTap`). No swipe actions —
/// edit / delete live in the sheet's header `Menu`.
///
/// Spec: `Pulpe v2 / components/screen-envd-mobile-bc5.jsx` (lines 245–345).
/// Subtitle rules (§08) and amount color rules (§07) are encoded inline.
struct BudgetLineMixedRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let isSyncing: Bool
    /// Display currency. Passed as a primitive `let` instead of read from
    /// the user-settings environment so the row does not observe the whole
    /// store and re-render on unrelated changes (broad observation fan-out).
    let currency: SupportedCurrency
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var triggerToggleFeedback = false

    // MARK: - Derived values

    /// `consumption.allocated` — sum of linked transactions on this line.
    private var realAmount: Decimal { consumption.allocated }
    /// `line.amount` — what the user planned for this envelope.
    private var plannedAmount: Decimal { line.amount }
    private var hasReal: Bool { realAmount > 0 }
    /// Equivalent of `e.real > e.planned` in the spec; matches `consumption.isOverBudget`.
    private var isOverBudget: Bool { consumption.isOverBudget }

    private var isPointed: Bool { line.isChecked }
    private var isIncome: Bool { line.kind == .income }
    private var isSaving: Bool { line.kind == .saving }
    private var isExpense: Bool { line.kind == .expense }

    /// Hero amount shown on the right — kind-aware semantics (spec §2.6):
    /// expenses surface the *remaining* envelope (the actionable info), while
    /// income/saving surface the *real* received/transferred amount (mental
    /// model: "did it land?" vs "did I transfer?"). Overflow surfaces the
    /// excess (real − planned) so the red number reads as the overshoot.
    private var displayAmount: Decimal {
        if isExpense {
            if isOverBudget { return realAmount - plannedAmount }
            if hasReal { return consumption.available }
            return plannedAmount
        }
        return hasReal ? realAmount : plannedAmount
    }

    /// Small grey caption under the hero amount. Kind-aware:
    /// - expense empty → `prévu`
    /// - expense partial → `restant sur {planned}`
    /// - expense overflow → `de dépassement`
    /// - income/saving partial → `/ {planned} prévu`
    /// - everything else (full, equal, no-progress income/saving) → none.
    private var amountSuffix: String? {
        if isExpense {
            if isOverBudget { return "de dépassement" }
            if !hasReal { return "prévu" }
            if realAmount == plannedAmount { return nil }
            return "restant sur \(plannedAmount.asAmount(for: currency))"
        }
        if hasReal, realAmount < plannedAmount {
            return "/ \(plannedAmount.asAmount(for: currency)) prévu"
        }
        return nil
    }

    /// Spec §07 — amount color cascade.
    /// Income / saving keep their category color even when `real > planned`
    /// (an over-received salary is good news, not a deficit). The overflow
    /// red is reserved for expenses that have actually blown the envelope.
    private var amountColor: Color {
        if isIncome { return .financialIncome }
        if isSaving { return .financialSavings }
        if isOverBudget { return .financialOverBudget }
        if consumption.percentage >= 50 { return .warningPrimary }
        return .textSecondary
    }

    /// Spec — color of the small "CHF" suffix. Tracks the amount color for
    /// income / saving / overflowing rows (with a slight tint reduction), falls
    /// back to neutral inks otherwise so the suffix never out-shouts the digits.
    private var currencyCodeColor: Color {
        if isIncome || isSaving || (isExpense && isOverBudget) {
            return amountColor
        }
        return hasReal ? .textTertiary : .textSecondary
    }

    /// Spec — opacity of the small "CHF" suffix. 0.8 only when it inherits the
    /// amount color (income / saving / over-budget expense), full strength otherwise.
    private var currencyCodeOpacity: Double {
        (isIncome || isSaving || (isExpense && isOverBudget)) ? DesignTokens.Opacity.pressed : 1
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
                PointCircle(
                    isPointed: isPointed,
                    color: dotColor,
                    isSyncing: isSyncing,
                    onToggle: handleTogglePointed
                )

                centerColumn

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountColumn

                chevron
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
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .shadow(DesignTokens.Shadow.subtle)
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
                .lineLimit(1)
                .truncationMode(.tail)

            subtitleView
                .font(PulpeTypography.metricLabelBold)
                .lineLimit(1)
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    // planned amount; repeating it as a subtitle would be redundant.
    @ViewBuilder
    private var savingSubtitle: some View {
        if hasReal && realAmount >= plannedAmount {
            Text("Transféré")
                .foregroundStyle(Color.textTertiary)
        } else if hasReal {
            let remaining = plannedAmount - realAmount
            Text("\(remaining.asCurrency(currency)) à transférer")
                .foregroundStyle(Color.textTertiary)
        }
    }

    // Expense overflow: "Budget dépassé" in the warm overflow color.
    // The excess amount lives on the right hero with the "de dépassement" suffix.
    @ViewBuilder
    private var overBudgetSubtitle: some View {
        Text("Budget dépassé")
            .foregroundStyle(Color.financialOverBudget)
    }

    // MARK: - Amount column (digits + suffix + planned hint)

    @ViewBuilder
    private var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                Text(displayAmount.asAmount(for: currency))
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(amountColor)
                    .monospacedDigit()
                    .lineLimit(1)

                Text(currency.symbol)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(currencyCodeColor)
                    .opacity(currencyCodeOpacity)
                    .tracking(DesignTokens.Tracking.uppercaseNarrow)
            }
            .sensitiveAmount()

            if let suffix = amountSuffix {
                Text(suffix)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
        }
        .lineLimit(1)
        .layoutPriority(1)
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
        let pointed = isPointed ? "Pointé" : "À pointer"
        let amount = displayAmount.asCurrency(currency)
        return "\(kindWord) · \(line.name) · \(amount) · \(pointed)"
    }
}
