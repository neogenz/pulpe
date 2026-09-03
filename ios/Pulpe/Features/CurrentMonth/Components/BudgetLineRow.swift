import SwiftUI

/// Single budget line row - Revolut-inspired design
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let allTransactions: [Transaction]
    let isSyncing: Bool
    let onToggle: (() -> Void)?
    let onAddTransaction: (() -> Void)?
    let onLongPress: (([Transaction]) -> Void)?
    let onEdit: (() -> Void)?

    init(
        line: BudgetLine,
        consumption: BudgetFormulas.Consumption,
        allTransactions: [Transaction],
        isSyncing: Bool,
        onToggle: (() -> Void)? = nil,
        onAddTransaction: (() -> Void)? = nil,
        onLongPress: (([Transaction]) -> Void)? = nil,
        onEdit: (() -> Void)? = nil
    ) {
        self.line = line
        self.consumption = consumption
        self.allTransactions = allTransactions
        self.isSyncing = isSyncing
        self.onToggle = onToggle
        self.onAddTransaction = onAddTransaction
        self.onLongPress = onLongPress
        self.onEdit = onEdit
    }

    @State private var isPressed = false
    @State private var triggerSuccessFeedback = false
    @State private var triggerWarningFeedback = false

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var hasConsumption: Bool { Self.hasConsumption(consumption) }

    private var consumptionColor: Color {
        guard line.kind == .expense else { return .secondary }
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return .secondary
    }

    private var amountTextColor: Color {
        if line.isChecked { return .secondary }
        // Expenses: always state color (icon carries category)
        if line.kind == .expense {
            if consumption.isOverBudget { return .financialOverBudget }
            if consumption.isNearLimit { return .warningPrimary }
            return .secondary
        }
        // Income & savings: category color when no consumption, secondary otherwise
        if hasConsumption { return .secondary }
        return line.kind.color
    }

    private var remainingAmountText: String {
        let amount = (line.kind == .expense ? consumption.available : line.amount).rounded(2)
        guard amount != 0 else { return amount.asAdaptiveAmount(for: userSettingsStore.currency) }
        let sign = line.kind == .income ? "+" : "-"
        return "\(sign)\(amount.absoluteValue.asAdaptiveAmount(for: userSettingsStore.currency))"
    }

    private var linkedTransactions: [Transaction] {
        allTransactions
            .filter { $0.budgetLineId == line.id }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    /// Whether anything has landed on the line yet. Two things switch on it — the
    /// tertiary sentence and the progress bar — and each used to spell the comparison
    /// out for itself.
    private static func hasConsumption(_ consumption: BudgetFormulas.Consumption) -> Bool {
        consumption.allocated > 0
    }

    static func consumptionSummary(
        consumption: BudgetFormulas.Consumption,
        currency: SupportedCurrency
    ) -> String {
        let spent = consumption.allocated.rounded(2).asAdaptiveCurrency(currency)
        let available = consumption.available.rounded(2)
        if available < 0 {
            let overrun = (-available).asAdaptiveCurrency(currency)
            return AppLocale.string("\(spent) dépensés · Dépassé de \(overrun)")
        }
        return AppLocale.string("\(spent) dépensés · \(Int(consumption.percentage.rounded()))% utilisé")
    }

    /// What the tertiary line says next to the recurrence glyph. The recurrence
    /// itself is deliberately absent: it used to be spelled out here, but only
    /// when nothing had been spent, so the same row changed vocabulary the
    /// moment a transaction landed on it. The glyph now states it in every case.
    static func tertiaryText(
        line: BudgetLine,
        consumption: BudgetFormulas.Consumption,
        currency: SupportedCurrency
    ) -> String? {
        if hasConsumption(consumption) {
            return consumptionSummary(consumption: consumption, currency: currency)
        }
        guard line.kind == .expense else { return nil }
        return AppLocale.string("sur \(line.amount.asCurrency(currency))")
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle (Revolut-style)
            kindIconCircle

            // Main content
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(line.name)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(line.isChecked ? .secondary : .primary)
                    .strikethrough(line.isChecked, color: .secondary)
                    .lineLimit(1)

                // Where the line comes from, then what it has consumed — the
                // glyph opens the line whether or not anything has been spent.
                HStack(spacing: DesignTokens.Spacing.xs) {
                    // Labelled rather than hidden: unlike the budget detail row,
                    // this one carries no explicit label to speak the word for it.
                    Image(systemName: line.recurrence.icon)
                        .accessibilityLabel(line.recurrence.label)

                    if let tertiaryText = Self.tertiaryText(
                        line: line,
                        consumption: consumption,
                        currency: userSettingsStore.currency
                    ) {
                        Text(tertiaryText)
                            .lineLimit(1)
                            .sensitiveAmount()
                    }
                }
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)

                if hasConsumption {
                    progressBar
                }
            }

            Spacer(minLength: 8)

            // Sync indicator
            SyncIndicator(isSyncing: isSyncing)

            // Amount (remaining when transactions exist, otherwise budgeted)
            Text(remainingAmountText)
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(amountTextColor)
                .sensitiveAmount()
        }
        }
        .contentShape(Rectangle())
        .onLongPressGesture(
            minimumDuration: 0.4,
            maximumDistance: 10,
            pressing: { pressing in
                guard onLongPress != nil else { return }
                withAnimation(.spring(duration: DesignTokens.Animation.fast)) {
                    isPressed = pressing
                }
            },
            perform: handleLongPress
        )
        // Prefer `onTapGesture` over wrapping the row in `Button`: we need long-press + tap on the same
        // hit target without nested button semantics (VoiceOver uses `accessibilityAction` below).
        .onTapGesture {
            guard let onAddTransaction, !line.isVirtualRollover else { return }
            onAddTransaction()
        }
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(duration: DesignTokens.Animation.fast), value: isPressed)
        .sensoryFeedback(.success, trigger: triggerSuccessFeedback)
        .sensoryFeedback(.error, trigger: triggerWarningFeedback)
        .accessibilityIdentifier("budgetLineRow-\(line.id)")
        .ifLet(onAddTransaction) { view, onAdd in
            view
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { onAdd() }
                .accessibilityHint(addTransactionHint)
        }
    }

    /// Whole sentences per variant rather than a concatenation: `+` on two literals binds
    /// the verbatim `Text`/hint overload, which the string extractor never sees.
    private var addTransactionHint: String {
        let gesture = AppLocale.string("Touche pour noter un montant, maintiens pour voir les mouvements")
        guard hasConsumption else { return gesture }
        let remaining = consumption.available.asCurrency(userSettingsStore.currency)
        return AppLocale.string("Montant restant: \(remaining).") + " " + gesture
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(
                    line.isChecked
                        ? Color.progressTrack
                        : line.kind.color.opacity(DesignTokens.Opacity.badgeBackground)
                )
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)

            if line.isChecked {
                // Show checkmark when checked
                Image(systemName: "checkmark")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textSecondary)
            } else {
                // Show kind icon
                Image(systemName: line.kind.icon)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(line.kind.color)
            }
        }
        .opacity(line.isVirtualRollover ? 0.6 : 1)
    }

    private var progressBar: some View {
        ZStack {
            Rectangle()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(min(consumption.percentage / 100, 1)))
                .fill(consumptionColor)
                .animation(DesignTokens.Animation.gentleSpring, value: consumption.percentage)
        }
        .frame(height: DesignTokens.ProgressBar.height)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.progressBar))
    }

    private func handleLongPress() {
        guard let onLongPress, !line.isVirtualRollover else { return }

        if linkedTransactions.isEmpty {
            triggerWarningFeedback.toggle()
            withAnimation(.spring(duration: DesignTokens.Animation.fast)) {
                isPressed = false
            }
        } else {
            triggerSuccessFeedback.toggle()
            onLongPress(linkedTransactions)
        }
    }
}
