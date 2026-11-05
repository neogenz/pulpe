import SwiftUI

/// What is left to point (V2 `À pointer`): the pointed balance that moves with each circle,
/// then the movements and the prévisions waiting for it. A row that was just pointed stays
/// where it is, saying so, until the page is left.
struct ToPointPage: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.requestEditMovement) private var requestEditMovement
    /// The pointed balance when the page opened: shown struck through once pointing moved it.
    @State private var openingBalance: Decimal?
    /// Ids pointed from this page; their rows stay until it is left.
    @State private var pointedHere: Set<String> = []
    @State private var isReconciling = false

    private var currency: SupportedCurrency { userSettingsStore.currency }
    private var balance: Decimal { store.realizedMetrics.realizedBalance }

    private var movements: [Transaction] {
        store.transactions
            .filter { !$0.isChecked || pointedHere.contains($0.id) }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    private var lines: [BudgetLine] {
        store.budgetLines.filter { !($0.isRollover ?? false) && (!$0.isChecked || pointedHere.contains($0.id)) }
    }

    private var lineNames: [String: String] {
        Dictionary(uniqueKeysWithValues: store.budgetLines.map { ($0.id, $0.name) })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(
                    title: AppLocale.string("À pointer"),
                    subtitle: AppLocale.string("Touche le rond dès que c'est passé sur ton compte.")
                )
                balanceCard
                if !movements.isEmpty { movementsSection }
                if !lines.isEmpty { linesSection }
                if movements.isEmpty, lines.isEmpty { doneBlock }
            }
            .padding(.top, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .background { Color.appBackground.ignoresSafeArea() }
        .navigationTitle(Tab.currentMonth.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .trackScreen("ToPoint")
        .onAppear { if openingBalance == nil { openingBalance = balance } }
        .sheet(isPresented: $isReconciling) { CurrentMonthReconcileSheet() }
    }

    // MARK: - Balance

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text("Ton solde pointé")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Button { isReconciling = true } label: {
                    HStack(spacing: DesignTokens.Spacing.xxs) {
                        Text("Comparer")
                        Image(systemName: "chevron.right").font(PulpeTypography.metricLabel)
                    }
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                    .contentShape(Rectangle())
                    .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
                }
                .textLinkButtonStyle()
                .accessibilityIdentifier("toPointCompare")
            }

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                (Text(verbatim: balance.asAdaptiveAmount(for: currency))
                    .font(PulpeTypography.bigAmount)
                    + Text(verbatim: " \(currency.symbol)")
                    .font(PulpeTypography.bigCurrencySuffix)
                    .foregroundStyle(Color.textTertiary))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .foregroundStyle(Color.textPrimary)
                    .contentTransition(.numericText())
                    .accessibilityIdentifier("toPointBalance")
                if let openingBalance, openingBalance != balance {
                    Text(verbatim: openingBalance.asAdaptiveAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(Color.textTertiary)
                        .strikethrough()
                        .transition(.opacity)
                }
            }
            .sensitiveAmount()
            .animation(DesignTokens.Animation.smoothEaseInOut, value: balance)

            Text("Il bouge à chaque pointage. Ton disponible à dépenser, lui, ne change pas.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Sections

    private var movementsSection: some View {
        let remaining = movements.filter { !$0.isChecked }.count
        return section(
            title: AppLocale.string("Mouvements"),
            trailing: AppLocale.string("\(remaining) à pointer"),
            caption: nil
        ) {
            ForEach(Array(movements.enumerated()), id: \.element.id) { index, transaction in
                if index > 0 { rowDivider }
                pointRow(
                    PointRowModel(
                        id: transaction.id,
                        title: transaction.name,
                        subtitle: ToPointPresentation.movementFact(
                            for: transaction,
                            lineName: transaction.budgetLineId.flatMap { lineNames[$0] },
                            pointedNow: pointedHere.contains(transaction.id)
                        ),
                        amount: transaction.amount.asAmount(for: currency),
                        isPointed: transaction.isChecked,
                        isSyncing: store.syncingTransactionIds.contains(transaction.id)
                    ),
                    onToggle: {
                        toggle(.transaction(transaction), id: transaction.id, wasPointed: transaction.isChecked)
                    },
                    onOpen: {
                        guard let budgetId = store.budget?.id else { return }
                        requestEditMovement?(budgetId, transaction.id)
                    }
                )
            }
        }
    }

    private var linesSection: some View {
        section(
            title: AppLocale.string("Prévisions du mois"),
            trailing: "\(lines.count)",
            caption: AppLocale.string("Pointe-les dès que le prélèvement est passé")
        ) {
            ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                let fact = ToPointPresentation.lineFact(
                    for: line,
                    consumption: BudgetFormulas.calculateConsumption(for: line, transactions: store.transactions),
                    currency: currency
                )
                if index > 0 { rowDivider }
                pointRow(
                    PointRowModel(
                        id: line.id,
                        title: line.name,
                        subtitle: fact.text,
                        isOverrun: fact.isOverrun,
                        amount: line.amount.asAmount(for: currency),
                        isPointed: line.isChecked,
                        isSyncing: store.syncingBudgetLineIds.contains(line.id)
                    ),
                    onToggle: { toggle(.budgetLine(line), id: line.id, wasPointed: line.isChecked) },
                    onOpen: { appState.pushOnActiveStack(BudgetDestination.details(budgetId: line.budgetId)) }
                )
            }
        }
    }

    private var doneBlock: some View {
        Text("Tout est pointé.")
            .font(PulpeTypography.bodyLarge)
            .foregroundStyle(Color.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(DesignTokens.Spacing.xxl)
            .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.surface))
            .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    private var rowDivider: some View {
        Divider().overlay(Color.outlineVariant).padding(.leading, DesignTokens.ListRow.dividerInset)
    }

    private func section<Content: View>(
        title: String,
        trailing: String,
        caption: String?,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(PulpeTypography.sectionTitle)
                        .foregroundStyle(Color.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    Text(trailing)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                }
                if let caption {
                    Text(caption)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xs)

            MovementCard { content() }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    /// What a row says and does; the two closures are its circle and its body.
    private struct PointRowModel {
        let id: String
        let title: String
        let subtitle: String
        var isOverrun = false
        let amount: String
        let isPointed: Bool
        let isSyncing: Bool
    }

    private func pointRow(
        _ row: PointRowModel,
        onToggle: @escaping () -> Void,
        onOpen: @escaping () -> Void
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            PointCircle(isPointed: row.isPointed, isSyncing: row.isSyncing, onToggle: onToggle)
                .accessibilityIdentifier("toPointCircle-\(row.id)")
            Button(action: onOpen) {
                PulpeListRow(
                    title: row.title,
                    subtitle: row.subtitle,
                    subtitleTint: row.isOverrun ? .financialOverBudget : .textSecondary,
                    trailing: { Text(row.amount).sensitiveAmount() }
                )
            }
            .plainPressedButtonStyle()
            // On the open button, not the row: there it would overwrite the point circle's id.
            .accessibilityIdentifier("toPointRow-\(row.id)")
        }
        .padding(.leading, DesignTokens.Spacing.xs)
        .padding(.trailing, DesignTokens.Spacing.lg)
    }

    // MARK: - Actions

    private func toggle(_ item: CurrentMonthStore.CheckableItem, id: String, wasPointed: Bool) {
        Task {
            ProductTips.checking.invalidate(reason: .actionPerformed)
            if wasPointed {
                switch item {
                case .transaction(let transaction, _): _ = await store.toggleTransaction(transaction)
                case .budgetLine(let line, _): _ = await store.toggleBudgetLine(line)
                }
            } else if await store.point(item, toasts: toastManager) {
                pointedHere.insert(id)
            }
        }
    }
}
