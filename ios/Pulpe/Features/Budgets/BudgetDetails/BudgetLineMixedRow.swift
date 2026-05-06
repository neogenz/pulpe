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
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore
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

    /// Hero amount shown on the right — real if any spending, otherwise planned.
    private var displayAmount: Decimal { hasReal ? realAmount : plannedAmount }

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
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .contentShape(Rectangle())
            .opacity(isPointed ? DesignTokens.Opacity.pointedDim : 1)
            .animation(
                reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                value: isPointed
            )
        }
        .buttonStyle(.plain)
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

    /// Spec §08 — subtitle rules. Empty when pointed or when an expense has
    /// no real spending yet (the row is loud enough already).
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
        } else if hasReal {
            remainingExpenseSubtitle
        } else {
            EmptyView()
        }
    }

    // Income: "Reçu" once fully covered, otherwise "X CHF à recevoir".
    @ViewBuilder
    private var incomeSubtitle: some View {
        if hasReal && realAmount >= plannedAmount {
            Text("Reçu")
                .foregroundStyle(Color.textTertiary)
        } else {
            let remaining = plannedAmount - realAmount
            Text("\(remaining.asCompactCurrency(userSettingsStore.currency)) à recevoir")
                .foregroundStyle(Color.textTertiary)
        }
    }

    // Saving: "Transféré" once fully covered, otherwise "X CHF à transférer".
    @ViewBuilder
    private var savingSubtitle: some View {
        if hasReal && realAmount >= plannedAmount {
            Text("Transféré")
                .foregroundStyle(Color.textTertiary)
        } else {
            let remaining = plannedAmount - realAmount
            Text("\(remaining.asCompactCurrency(userSettingsStore.currency)) à transférer")
                .foregroundStyle(Color.textTertiary)
        }
    }

    // Expense overflow: "Dépassé · −X CHF" in the warm overflow color.
    @ViewBuilder
    private var overBudgetSubtitle: some View {
        let excess = realAmount - plannedAmount
        Text("Dépassé · −\(excess.asCompactCurrency(userSettingsStore.currency))")
            .foregroundStyle(Color.financialOverBudget)
    }

    // Expense within budget but partially spent: "X CHF restant".
    @ViewBuilder
    private var remainingExpenseSubtitle: some View {
        let remaining = plannedAmount - realAmount
        Text("\(remaining.asCompactCurrency(userSettingsStore.currency)) restant")
            .foregroundStyle(Color.textTertiary)
    }

    // MARK: - Amount column (digits + suffix + planned hint)

    @ViewBuilder
    private var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                Text(displayAmount.asAmount(for: userSettingsStore.currency))
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(amountColor)
                    .monospacedDigit()
                    .lineLimit(1)

                Text(userSettingsStore.currency.symbol)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(currencyCodeColor)
                    .opacity(currencyCodeOpacity)
                    .tracking(DesignTokens.Tracking.uppercaseNarrow)
            }
            .sensitiveAmount()

            // "/ X prévu" — only when there's spending below planned and the two differ.
            if hasReal, !isOverBudget, realAmount != plannedAmount {
                Text("/ \(plannedAmount.asAmount(for: userSettingsStore.currency)) prévu")
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
        let amount = displayAmount.asCurrency(userSettingsStore.currency)
        return "\(kindWord) · \(line.name) · \(amount) · \(pointed)"
    }
}

// MARK: - PointCircle (iOS Reminders-style toggle)

/// 44×44 hit area, 24pt visible circle. Tap toggles via `onToggle` callback;
/// the parent owns state and animates `isPointed` flips. Uses `Button` so the
/// tap is visible to VoiceOver and can be hit independently of the parent row's
/// own tap target. Apple HIG: 44pt minimum tap area.
private struct PointCircle: View {
    let isPointed: Bool
    let color: Color
    let isSyncing: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            ZStack {
                Circle()
                    .fill(isPointed ? color : Color.clear)
                    .overlay {
                        Circle()
                            .strokeBorder(
                                isPointed ? color : Color.outlineVariant,
                                lineWidth: DesignTokens.BorderWidth.thick
                            )
                    }
                    .frame(
                        width: DesignTokens.Checkbox.size,
                        height: DesignTokens.Checkbox.size
                    )

                if isPointed {
                    Image(systemName: "checkmark")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .transition(.scale.combined(with: .opacity))
                }

                if isSyncing {
                    SyncIndicator(isSyncing: true)
                        .offset(x: DesignTokens.Checkbox.size / 2 - 2, y: -DesignTokens.Checkbox.size / 2 + 2)
                }
            }
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(isPointed ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Previews

private extension BudgetLine {
    static func preview(
        id: String = UUID().uuidString,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence = .fixed,
        isChecked: Bool = false
    ) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: "preview-budget",
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: recurrence,
            isManuallyAdjusted: false,
            checkedAt: isChecked ? Date() : nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

private struct BudgetLineMixedRowPreviewHost: View {
    let cases: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(Array(cases.enumerated()), id: \.offset) { _, item in
                    BudgetLineMixedRow(
                        line: item.line,
                        consumption: item.consumption,
                        isSyncing: false,
                        onTap: {},
                        onTogglePointed: {}
                    )
                }
            }
            .padding(DesignTokens.Spacing.lg)
        }
        .background(Color.appBackground)
        .environment(UserSettingsStore())
    }
}

#Preview("Expense — empty (no real)") {
    let line = BudgetLine.preview(name: "Téléphone", amount: 100, kind: .expense)
    let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: [])
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Expense — partial (260 CHF restant)") {
    let line = BudgetLine.preview(name: "Courses", amount: 800, kind: .expense)
    let consumption = BudgetFormulas.Consumption(allocated: 540, available: 260, percentage: 67.5)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Expense — over budget") {
    let line = BudgetLine.preview(name: "Sorties & loisirs", amount: 300, kind: .expense)
    let consumption = BudgetFormulas.Consumption(allocated: 320, available: -20, percentage: 106.7)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Income — partially received") {
    let line = BudgetLine.preview(name: "Salaire", amount: 7500, kind: .income)
    let consumption = BudgetFormulas.Consumption(allocated: 3000, available: 4500, percentage: 40)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Saving — fully transferred") {
    let line = BudgetLine.preview(name: "Épargne du mois", amount: 600, kind: .saving)
    let consumption = BudgetFormulas.Consumption(allocated: 600, available: 0, percentage: 100)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Pointed (dimmed)") {
    let line = BudgetLine.preview(name: "Loyer", amount: 2100, kind: .expense, isChecked: true)
    let consumption = BudgetFormulas.Consumption(allocated: 2100, available: 0, percentage: 100)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Mixed list") {
    let income = BudgetLine.preview(name: "Salaire", amount: 7500, kind: .income)
    let incomeConsumption = BudgetFormulas.Consumption(allocated: 7500, available: 0, percentage: 100)

    let saving = BudgetLine.preview(name: "Épargne du mois", amount: 600, kind: .saving)
    let savingConsumption = BudgetFormulas.Consumption(allocated: 600, available: 0, percentage: 100)

    let phone = BudgetLine.preview(name: "Téléphone", amount: 100, kind: .expense)
    let phoneConsumption = BudgetFormulas.calculateConsumption(for: phone, transactions: [])

    let groceries = BudgetLine.preview(name: "Courses", amount: 800, kind: .expense)
    let groceriesConsumption = BudgetFormulas.Consumption(allocated: 540, available: 260, percentage: 67.5)

    let leisure = BudgetLine.preview(name: "Sorties & loisirs", amount: 300, kind: .expense)
    let leisureConsumption = BudgetFormulas.Consumption(allocated: 320, available: -20, percentage: 106.7)

    return BudgetLineMixedRowPreviewHost(cases: [
        (income, incomeConsumption),
        (saving, savingConsumption),
        (phone, phoneConsumption),
        (groceries, groceriesConsumption),
        (leisure, leisureConsumption),
    ])
}
