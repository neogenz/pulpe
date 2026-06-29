import SwiftUI

/// Inline free-transactions list for the budget detail screen.
///
/// Replaces the List-bound `TransactionSection` when the parent uses
/// `ScrollView/LazyVStack`. Each row is a tap target that opens the
/// transaction edit sheet (matching the budget-line detail flow).
///
/// Visual: rows mirror `BudgetLineMixedRow` (point circle · kind tag · name ·
/// date subtitle · amount + currency suffix · chevron). Pointing a free
/// transaction is a personal reconciliation marker — like envelopes, it never
/// changes any total — so the leading slot carries a real `PointCircle`.
///
/// Accepts pre-shaped `FreeTransactionItem`s — the projection layer carries
/// the `isSyncing` flag so the view stays free of `.contains` over a syncing
/// id set in the body.
struct BudgetDetailsFreeTransactionsList: View {
    let items: [BudgetDetailsScreenState.FreeTransactionItem]
    let currency: SupportedCurrency
    let onTap: (Transaction) -> Void
    let onTogglePointed: (Transaction) -> Void

    @State private var isExpanded = false
    private let collapsedItemCount = 3

    private var displayedItems: [BudgetDetailsScreenState.FreeTransactionItem] {
        if isExpanded || items.count <= collapsedItemCount {
            return items
        }
        // `prefix` returns an `ArraySlice`; converting to `Array` is a literal
        // initializer (not a `.map` transform) so the body stays compliant
        // with `no_collection_ops_in_view_body`.
        return Array(items.prefix(collapsedItemCount))
    }

    private var hasMoreItems: Bool { items.count > collapsedItemCount }
    private var hiddenItemsCount: Int { items.count - collapsedItemCount }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                Text("Transactions libres")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)
                Text(" · \(items.count)")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("Transactions libres, \(items.count)")
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(displayedItems) { item in
                BudgetDetailsFreeTransactionRow(
                    transaction: item.transaction,
                    isSyncing: item.isSyncing,
                    currency: currency,
                    onTap: { onTap(item.transaction) },
                    onTogglePointed: { onTogglePointed(item.transaction) }
                )
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
            }

            if hasMoreItems {
                Button {
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.quickSnap)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        Text(isExpanded ? "Voir moins" : "Voir plus (+\(hiddenItemsCount))")
                            .font(PulpeTypography.subheadline)
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .textLinkButtonStyle()
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }
}

// MARK: - Row

/// Free-transaction row visually aligned with `BudgetLineMixedRow`: a leading
/// `PointCircle` toggle, then kind tag + name + date subtitle on the left,
/// kind-tinted amount + currency suffix on the right, chevron. Tapping the
/// circle points/unpoints the transaction (`onTogglePointed`); tapping the row
/// surface opens the edit sheet (`onTap`).
private struct BudgetDetailsFreeTransactionRow: View {
    let transaction: Transaction
    let isSyncing: Bool
    let currency: SupportedCurrency
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var triggerToggleFeedback = false

    private var kind: TransactionKind { transaction.kind }
    private var isIncome: Bool { kind == .income }
    private var isSaving: Bool { kind == .saving }
    private var isPointed: Bool { transaction.isChecked }

    /// PointCircle dot color — kind-based, mirroring `BudgetLineMixedRow.dotColor`
    /// minus the over-budget branch (a free transaction has no envelope to
    /// overshoot). Expenses use `financialExpense` so the pointed state stays
    /// visually consistent with envelope rows.
    private var dotColor: Color {
        if isIncome { return .financialIncome }
        if isSaving { return .financialSavings }
        return .financialExpense
    }

    /// Mirrors `BudgetLineMixedRow.amountColor` minus the consumption-driven
    /// branches (no envelope to overshoot). Expenses fall back to the neutral
    /// secondary ink so the right column stays readable on the white card.
    private var amountColor: Color {
        if isIncome { return .financialIncome }
        if isSaving { return .financialSavings }
        return .textSecondary
    }

    /// Currency suffix tints with the amount when the kind carries a color
    /// signal (income / saving); falls back to tertiary ink otherwise so
    /// expenses don't read as a red mark.
    private var currencySuffixColor: Color {
        (isIncome || isSaving) ? amountColor : .textTertiary
    }

    private var currencySuffixOpacity: Double {
        (isIncome || isSaving) ? DesignTokens.Opacity.pressed : 1
    }

    private var accessibilityLabel: String {
        let amount = transaction.amount.asCurrency(currency)
        let pointed = isPointed ? "Pointé" : "À pointer"
        let date = transaction.transactionDate.dayMonthFormatted
        return "\(kind.label) · \(transaction.name) · \(amount) · \(date) · \(pointed)"
    }

    private func handleTogglePointed() {
        triggerToggleFeedback.toggle()
        onTogglePointed()
    }

    var body: some View {
        Button(action: onTap) {
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
        .accessibilityHint("Touche pour modifier")
    }

    private var centerColumn: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            KindTagInline(kind: kind)

            Text(transaction.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
                .strikethrough(isPointed, color: Color.textTertiary)
                .lineLimit(1)
                .truncationMode(.tail)

            Text(transaction.transactionDate.dayInMonthFormatted)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textTertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var amountColumn: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
            Text(transaction.amount.asAmount(for: currency))
                .font(PulpeTypography.amountCard)
                .foregroundStyle(amountColor)
                .monospacedDigit()
                .lineLimit(1)

            Text(currency.symbol)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(currencySuffixColor)
                .opacity(currencySuffixOpacity)
                .tracking(DesignTokens.Tracking.uppercaseNarrow)
        }
        .sensitiveAmount()
        .layoutPriority(1)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Color.textTertiary)
            .padding(.leading, DesignTokens.Spacing.xs)
            .accessibilityHidden(true)
    }
}
