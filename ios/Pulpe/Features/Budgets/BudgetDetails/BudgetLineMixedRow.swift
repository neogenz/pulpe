import SwiftUI
import TipKit

/// One ledger row of the budget detail (V2 `row`): pointing ring, name over one fact, amount,
/// chevron. Lives inside the section's grouped card; it carries no card of its own.
/// The ring remains independently actionable.
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
    /// Anchors the checking tip's arrow on this row's disc — the control it teaches.
    var showsCheckingTip = false
    var onPrepareTogglePointed: () -> Bool = { true }
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var pointCompletionGate = PointCompletionGate()

    // MARK: - Derived values

    private var isPointed: Bool { line.isPointed(allocated: consumption.allocated) }

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
        if isSpread { parts.append(AppLocale.string("Lissé")) }
        if let savingsGoalName { parts.append(AppLocale.string("objectif \(savingsGoalName)")) }
        if isSavingsWithdrawalIncome { parts.append(AppLocale.string("Pris sur ton épargne")) }
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

    private var presentation: BudgetLineRowPresentation {
        BudgetLineRowPresentation(
            line: line,
            consumption: consumption,
            savingsGoalName: savingsGoalName,
            isPointed: isPointed,
            currency: currency
        )
    }

    // MARK: - Body

    /// V2 `row`: the neutral ring points, the rest of the row opens. No kind colour, no
    /// strikethrough: a pointed line keeps full ink and says "pointé" in its one fact.
    var body: some View {
        let presentation = presentation
        // At accessibility sizes the amount goes under the name: beside it, a narrow screen
        // (folded iPhone Duo) left the name a column so thin it broke mid-word.
        let stacksAmount = dynamicTypeSize.isAccessibilitySize
        return Button(action: handleTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                PointCircle(
                    isPointed: isPointed,
                    isSyncing: isSyncing,
                    onPrepareToggle: onPrepareTogglePointed,
                    onCompletionStateChange: { pointCompletionGate.isPending = $0 },
                    onToggle: handleTogglePointed
                )
                .popoverTip(showsCheckingTip ? ProductTips.checking : nil)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(line.name)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                        .truncationMode(.tail)
                    if stacksAmount { amountText(presentation.amount) }
                    if let progress = presentation.progress {
                        consumptionBar(progress: progress, isOver: presentation.isOver)
                    }
                    Text(presentation.subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(presentation.isOver ? Color.financialOverBudget : Color.textSecondary)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                        .truncationMode(.tail)
                        .sensitiveAmount()
                        .accessibilityIdentifier("budgetLineMixedRowMetadata-\(line.id)")
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if !stacksAmount { amountText(presentation.amount).layoutPriority(1) }

                RowChevron()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
            .animation(
                reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                value: isPointed
            )
        }
        .buttonStyle(.plain)
        // Second path to the same toggle, the gesture Mail taught.
        .leadingSwipeAction(
            systemImage: isPointed ? "arrow.uturn.backward" : "checkmark",
            tint: .pulpePrimary,
            isEnabled: { !pointCompletionGate.isPending && !isSyncing },
            action: handleTogglePointed
        )
        // Explicit, or the button inherits the subtitle Text's identifier from its label.
        .accessibilityIdentifier("budgetLineMixedRowButton-\(line.id)")
        // Left to itself the activation point lands on the nested PointCircle, so Voice
        // Control's "tap" (and XCUITest's) points the line instead of opening it.
        .accessibilityActivationPoint(.center)
        // `.contain` keeps the inner PointCircle as its own focus node so VoiceOver
        // can drive the pointed/unpointed toggle independently of the row's tap-to-open.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Touche pour ouvrir le détail")
        .accessibilityIdentifier("budgetLineMixedRow-\(line.id)")
    }

    private func amountText(_ amount: String) -> some View {
        Text(amount)
            .font(PulpeTypography.rowAmount)
            .foregroundStyle(Color.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.compact)
            .sensitiveAmount()
    }

    /// Thin bar under the name of a prévision being consumed; ocre once it overflows.
    private func consumptionBar(progress: Double, isOver: Bool) -> some View {
        ZStack(alignment: .leading) {
            Color.progressTrack.clipShape(.capsule)
            ProgressBarShape(progress: CGFloat(progress))
                .fill(isOver ? Color.financialOverBudget : Color.textPrimary)
        }
        .frame(height: DesignTokens.ProgressBar.height)
        .padding(.vertical, DesignTokens.Spacing.xxs)
        .accessibilityHidden(true)
    }

    // MARK: - Actions

    private func handleTap() {
        guard !line.isVirtualRollover else { return }
        onTap()
    }

    private func handleTogglePointed() {
        guard !line.isVirtualRollover else { return }
        onTogglePointed()
    }

    // MARK: - Accessibility

    /// The row's state, resolved here and spoken by `Self.accessibilityLabel`.
    private var accessibilityLabel: String {
        // The row speaks its state, never its action: the disc carries the verb.
        let status = isPointed ? AppLocale.string("Pointé") : AppLocale.string("À pointer")
        return Self.accessibilityLabel(
            line: line,
            status: status,
            amount: max(line.amount, consumption.allocated).asCurrency(currency),
            metadata: metadata,
            tagNames: tagNames
        )
    }
}
