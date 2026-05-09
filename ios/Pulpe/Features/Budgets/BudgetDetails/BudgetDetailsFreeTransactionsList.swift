import SwiftUI

/// Inline free-transactions list for the budget detail screen.
///
/// Replaces the List-bound `TransactionSection` when the parent uses
/// `ScrollView/LazyVStack`. Each row is a tap target that opens the
/// transaction edit sheet (matching the budget-line detail flow).
///
/// Visual: rows mirror `BudgetLineMixedRow` (kind tag · name · date
/// subtitle · amount + currency suffix · chevron) with a leading inset that
/// preserves the column rhythm of envelope rows. Free transactions are
/// auto-counted, so there is no checkbox/`PointCircle` toggle.
struct BudgetDetailsFreeTransactionsList: View {
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onTap: (Transaction) -> Void

    @State private var isExpanded = false
    private let collapsedItemCount = 3

    private var displayedTransactions: [Transaction] {
        if isExpanded || transactions.count <= collapsedItemCount {
            return transactions
        }
        return Array(transactions.prefix(collapsedItemCount))
    }

    private var hasMoreItems: Bool { transactions.count > collapsedItemCount }
    private var hiddenItemsCount: Int { transactions.count - collapsedItemCount }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                Text("Transactions libres")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)
                Text(" · \(transactions.count)")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("Transactions libres, \(transactions.count)")
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(displayedTransactions) { transaction in
                BudgetDetailsFreeTransactionRow(
                    transaction: transaction,
                    isSyncing: syncingIds.contains(transaction.id),
                    onTap: { onTap(transaction) }
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

/// Free-transaction row visually aligned with `BudgetLineMixedRow`: kind tag
/// + name + date subtitle on the left, kind-tinted amount + currency suffix
/// on the right, chevron. No `PointCircle` — free transactions are
/// auto-counted, so the leading column reserves the same horizontal space
/// as the envelope toggle to keep card rhythm consistent.
private struct BudgetDetailsFreeTransactionRow: View {
    let transaction: Transaction
    let isSyncing: Bool
    let onTap: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var kind: TransactionKind { transaction.kind }
    private var isIncome: Bool { kind == .income }
    private var isSaving: Bool { kind == .saving }

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
        let amount = transaction.amount.asCurrency(userSettingsStore.currency)
        return "\(kind.label) · \(transaction.name) · \(amount) · \(transaction.transactionDate.dayMonthFormatted)"
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                // Empty leading slot keeps the same column origin as
                // `BudgetLineMixedRow` (PointCircle width + leading xs) so
                // free-tx and envelope rows share a clean vertical rhythm.
                Color.clear
                    .frame(
                        width: DesignTokens.Checkbox.size,
                        height: DesignTokens.Checkbox.size
                    )

                centerColumn

                Spacer(minLength: DesignTokens.Spacing.sm)

                SyncIndicator(isSyncing: isSyncing)

                amountColumn

                chevron
            }
            .padding(.vertical, DesignTokens.Spacing.md)
            .padding(.leading, DesignTokens.Spacing.xs)
            .padding(.trailing, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .shadow(DesignTokens.Shadow.subtle)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Touche pour modifier")
        .accessibilityAddTraits(.isButton)
    }

    private var centerColumn: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            KindTagInline(kind: kind)

            Text(transaction.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
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
            Text(transaction.amount.asAmount(for: userSettingsStore.currency))
                .font(PulpeTypography.amountCard)
                .foregroundStyle(amountColor)
                .monospacedDigit()
                .lineLimit(1)

            Text(userSettingsStore.currency.symbol)
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
