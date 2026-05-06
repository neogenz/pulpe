import SwiftUI

/// Bottom sheet detail for a budget line (DM2.1.c spec).
///
/// Replaces the slide-options pattern with a header `Menu` (Modifier / Supprimer)
/// and a hero block that emphasises remaining budget. Transactions render with
/// multi-currency awareness: when a transaction was captured in a foreign
/// currency, a small original-currency caption appears under the user-currency
/// amount.
struct BudgetLineDetailSheet: View {
    let budgetLine: BudgetLine
    let transactions: [Transaction]
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onEditTransaction: (Transaction) -> Void
    let onDeleteTransaction: (Transaction) -> Void
    let onToggleTransaction: (Transaction) -> Void
    let onAddTransaction: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    // MARK: - Derived

    private var consumption: BudgetFormulas.Consumption {
        BudgetFormulas.calculateConsumption(for: budgetLine, transactions: transactions)
    }

    private var remaining: Decimal {
        budgetLine.amount - consumption.allocated
    }

    private var clampedProgress: CGFloat {
        CGFloat(min(max(consumption.percentage / 100, 0), 1))
    }

    /// 3-state color matching DA §3.1 — comfortable / tight / deficit.
    private var stateColor: Color {
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return Color.financialColor(for: budgetLine.kind)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            List {
                Section {
                    heroSection
                        .listRowCustomStyled(insets: EdgeInsets())
                }
                .listSectionSeparator(.hidden)

                if transactions.isEmpty {
                    Section {
                        emptyStateView
                            .listRowCustomStyled(insets: EdgeInsets())
                    }
                    .listSectionSeparator(.hidden)
                } else {
                    Section {
                        ForEach(transactions) { transaction in
                            BudgetLineDetailTransactionRow(
                                transaction: transaction,
                                displayCurrency: userSettingsStore.currency,
                                onTap: { onEditTransaction(transaction) }
                            )
                            .listRowSeparator(.visible)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                swipeActions(for: transaction)
                            }
                        }
                    } header: {
                        transactionsHeader
                            .textCase(nil)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(DesignTokens.Spacing.lg)
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) {
                addTransactionButton
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
                ToolbarItem(placement: .principal) {
                    titleWithKindDot
                }
                ToolbarItem(placement: .primaryAction) {
                    headerMenu
                }
            }
        }
        .accessibilityIdentifier("budgetLineDetailSheetRoot")
        .standardSheetPresentation(detents: [.medium, .large])
    }

    // MARK: - Hero

    @ViewBuilder
    private var heroSection: some View {
        let currency = userSettingsStore.currency
        let remainingLabel = amountsHidden ? "Montant masqué" : remaining.asCurrency(currency)
        let spentLabel = amountsHidden ? "Montant masqué" : consumption.allocated.asCompactCurrency(currency)
        let plannedLabel = amountsHidden ? "Montant masqué" : budgetLine.amount.asCompactCurrency(currency)

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Il reste")
                    .font(PulpeTypography.detailLabelBold)
                    .foregroundStyle(Color.textTertiary)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercase)

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(remaining.asCompactAmount(for: currency))
                        .font(PulpeTypography.amountHero)
                        .foregroundStyle(stateColor)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)

                    Text(currency.symbol)
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textTertiary)
                }
                .sensitiveAmount()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Il reste \(remainingLabel)")
            }

            progressRow

            Text("\(spentLabel) dépensés sur \(plannedLabel) prévu")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private var progressRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.progressTrack)

                ProgressBarShape(progress: clampedProgress)
                    .fill(stateColor)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            Text("\(Int(consumption.percentage.rounded()))%")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(stateColor)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Int(consumption.percentage.rounded()))% utilisé")
    }

    // MARK: - Title with kind dot (DM2.1.c spec — line title prefixed by a colored dot)

    private var titleWithKindDot: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Circle()
                .fill(Color.financialColor(for: budgetLine.kind))
                .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)

            Text(budgetLine.name)
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(budgetLine.name)
    }

    // MARK: - Header Menu

    private var headerMenu: some View {
        Menu {
            Button {
                onEdit()
            } label: {
                Label("Modifier", systemImage: "pencil")
            }

            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Plus d'options")
    }

    // MARK: - Transactions Header

    private var transactionsHeader: some View {
        HStack {
            Text("Transactions")
                .font(PulpeTypography.headline)
                .foregroundStyle(.primary)

            Spacer()

            Text(transactionCountLabel)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
        }
    }

    private var transactionCountLabel: String {
        switch transactions.count {
        case 0: "Aucune"
        case 1: "1 ce mois"
        default: "\(transactions.count) ce mois"
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(PulpeTypography.amountHeroLight)
                .foregroundStyle(.quaternary)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Pas encore de transaction")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textSecondary)

                Text("Ajoute une transaction pour suivre tes dépenses")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.stepHeaderTop)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    // MARK: - Swipe Actions

    @ViewBuilder
    private func swipeActions(for transaction: Transaction) -> some View {
        Button {
            onDeleteTransaction(transaction)
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
        .tint(Color.destructivePrimary)

        Button {
            onToggleTransaction(transaction)
        } label: {
            Label(
                transaction.isChecked ? "Dépointer" : "Pointer",
                systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
            )
        }
        .tint(transaction.isChecked ? Color.financialOverBudget : .pulpePrimary)

        Button {
            onEditTransaction(transaction)
        } label: {
            Label("Modifier", systemImage: "pencil")
        }
        .tint(.editAction)
    }

    // MARK: - Add Transaction Button

    private var addTransactionButton: some View {
        Button {
            onAddTransaction()
        } label: {
            Label("Ajouter une transaction", systemImage: "plus")
        }
        .primaryButtonStyle()
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.md)
        .background {
            Color.sheetBackground
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

// MARK: - Transaction Row

/// Compact row designed for the budget line detail sheet (DM2.1.c spec).
/// Differs from `TransactionRow`: no kind icon circle (the parent envelope already
/// communicates the kind), inline FX caption directly under the amount.
private struct BudgetLineDetailTransactionRow: View {
    let transaction: Transaction
    let displayCurrency: SupportedCurrency
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(transaction.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                        .strikethrough(transaction.isChecked, color: .secondary)
                        .lineLimit(1)

                    Text(transaction.transactionDate.relativeFormatted)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textTertiary)
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountColumn
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Touche pour modifier")
    }

    private var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.amount.asAmount(for: displayCurrency))
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(transaction.isChecked ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                    .monospacedDigit()

                Text(displayCurrency.symbol)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            if let secondary = TransactionAmountView.secondaryText(for: transaction, in: displayCurrency) {
                Text(secondary)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .accessibilityLabel("saisi en \(secondary)")
            }
        }
        .sensitiveAmount()
    }
}

// MARK: - Preview Helpers

private enum PreviewFactory {
    static func line(name: String, amount: Decimal) -> BudgetLine {
        BudgetLine(
            id: name,
            budgetId: "b1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: .expense,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    static func tx(
        _ id: String,
        name: String,
        amount: Decimal,
        daysAgo: Int = 0,
        checked: Bool = false,
        fxOriginal: (amount: Decimal, currency: SupportedCurrency)? = nil
    ) -> Transaction {
        Transaction(
            id: id,
            budgetId: "b1",
            budgetLineId: "1",
            name: name,
            amount: amount,
            kind: .expense,
            transactionDate: Date().addingTimeInterval(TimeInterval(-86400 * daysAgo)),
            category: nil,
            checkedAt: checked ? Date() : nil,
            createdAt: Date(),
            updatedAt: Date(),
            originalAmount: fxOriginal?.amount,
            originalCurrency: fxOriginal?.currency,
            targetCurrency: fxOriginal == nil ? nil : .chf,
            exchangeRate: nil
        )
    }
}

private struct PreviewHost: View {
    let line: BudgetLine
    let transactions: [Transaction]

    var body: some View {
        Color.clear
            .sheet(isPresented: .constant(true)) {
                BudgetLineDetailSheet(
                    budgetLine: line,
                    transactions: transactions,
                    onEdit: {},
                    onDelete: {},
                    onEditTransaction: { _ in },
                    onDeleteTransaction: { _ in },
                    onToggleTransaction: { _ in },
                    onAddTransaction: {}
                )
                .environment(UserSettingsStore())
            }
    }
}

// MARK: - Previews

#Preview("With FX Transactions") {
    PreviewHost(
        line: PreviewFactory.line(name: "Courses", amount: 800),
        transactions: [
            PreviewFactory.tx("t1", name: "Migros · Conthey", amount: 87.40),
            PreviewFactory.tx(
                "t2", name: "Carrefour · Sallanches", amount: 42.10, daysAgo: 3,
                fxOriginal: (38.50, .eur)
            ),
            PreviewFactory.tx("t3", name: "Coop · Sion", amount: 64.20, daysAgo: 6),
            PreviewFactory.tx("t4", name: "Aligro · Vétroz", amount: 156.80, daysAgo: 12, checked: true),
            PreviewFactory.tx(
                "t5", name: "Casino · Annemasse", amount: 89.50, daysAgo: 16,
                fxOriginal: (81.20, .eur)
            ),
            PreviewFactory.tx("t6", name: "Migros · Lausanne", amount: 100, daysAgo: 20)
        ]
    )
}

#Preview("Over Budget") {
    PreviewHost(
        line: PreviewFactory.line(name: "Restaurants", amount: 300),
        transactions: [
            PreviewFactory.tx("t1", name: "Café du Coin", amount: 220),
            PreviewFactory.tx("t2", name: "Brasserie de Plainpalais", amount: 175, daysAgo: 4, checked: true)
        ]
    )
}

#Preview("Empty") {
    PreviewHost(
        line: PreviewFactory.line(name: "Loisirs", amount: 200),
        transactions: []
    )
}
