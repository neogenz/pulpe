import SwiftUI

/// Inline list of the budget detail screen's free transactions ("Hors prévision").
///
/// Replaces the List-bound `TransactionSection` when the parent uses
/// `ScrollView/LazyVStack`. Each row is a tap target; the parent decides
/// whether it opens the edit sheet or the envelope.
///
/// Visual: rows mirror `BudgetLineMixedRow` (point circle · kind tag · name ·
/// « 5 novembre · pointé » · ink amount · chevron, as `MovementRow`). Pointing a free
/// transaction is a personal reconciliation marker — like envelopes, it never
/// changes any total — so the leading slot carries a real `PointCircle`.
///
/// Accepts pre-shaped `FreeTransactionItem`s — the projection layer carries
/// the `isSyncing` flag so the view stays free of `.contains` over a syncing
/// id set in the body.
struct BudgetDetailsFreeTransactionsList: View {
    var subtitle: String?
    /// Header total; without one the header counts the rows.
    var total: String?
    let items: [BudgetDetailsScreenState.FreeTransactionItem]
    let currency: SupportedCurrency
    let tagNamesById: [String: String]
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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: PendingWording.unplanned,
                count: total == nil ? items.count : nil,
                subtitle: subtitle,
                trailingAmount: total
            )

            VStack(spacing: 0) {
                ForEach(displayedItems) { item in
                    if item.id != displayedItems.first?.id {
                        Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                    }
                    BudgetDetailsFreeTransactionRow(
                        transaction: item.transaction,
                        isSyncing: item.isSyncing,
                        currency: currency,
                        tagNames: TagChips.names(for: item.transaction.tagIds, namesById: tagNamesById),
                        onTap: { onTap(item.transaction) },
                        onTogglePointed: { onTogglePointed(item.transaction) }
                    )
                    .transition(.asymmetric(
                        insertion: .opacity,
                        removal: .opacity.combined(
                            with: .scale(scale: DesignTokens.Animation.settleScale)
                        )
                    ))
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeRowCard()

            if hasMoreItems {
                Button {
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.quickSnap)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        (isExpanded ? Text("Voir moins") : Text("Voir plus (+\(hiddenItemsCount))"))
                            .font(PulpeTypography.subheadline)
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .textLinkButtonStyle()
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xxl)
    }
}

// MARK: - Row

/// Transaction row visually aligned with `BudgetLineMixedRow`: a leading
/// `PointCircle` disc, then name + date subtitle on the left, the ink amount on the right (V2: color never codes the kind),
/// chevron. Tapping the circle points/unpoints the transaction
/// (`onTogglePointed`); tapping the row surface runs `onTap`.
private struct BudgetDetailsFreeTransactionRow: View {
    let transaction: Transaction
    let isSyncing: Bool
    let currency: SupportedCurrency
    let tagNames: [String]
    let onTap: () -> Void
    let onTogglePointed: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var pointCompletionGate = PointCompletionGate()

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

    private var accessibilityLabel: String {
        let amount = transaction.amount.asCurrency(currency)
        let pointed = isPointed ? AppLocale.string("Pointé") : AppLocale.string("À pointer")
        let date = transaction.transactionDate.dayMonthFormatted
        let tags = tagNames.isEmpty
            ? ""
            : " · " + AppLocale.string("Tags : \(tagNames.joined(separator: ", "))")
        let origin = transaction.savingsGoalSource.map { " · \($0.accessibilityLabel)" } ?? ""
        return "\(kind.label) · \(transaction.name) · \(amount) · \(date) · \(pointed)\(tags)\(origin)"
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                PointCircle(
                    isPointed: isPointed,
                    isSyncing: isSyncing,
                    onCompletionStateChange: { pointCompletionGate.isPending = $0 },
                    onToggle: onTogglePointed
                )

                centerColumn

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountColumn

                RowChevron()
            }
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
            .animation(
                reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                value: isPointed
            )
        }
        .buttonStyle(.plain)
        .leadingSwipeAction(
            systemImage: isPointed ? "arrow.uturn.backward" : "checkmark",
            tint: dotColor,
            isEnabled: { !pointCompletionGate.isPending && !isSyncing },
            action: onTogglePointed
        )
        // `.contain` keeps the inner PointCircle as its own focus node so VoiceOver
        // can drive the pointed/unpointed toggle independently of the row's tap-to-open.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Touche pour modifier")
    }

    private var centerColumn: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(transaction.name)
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)

            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(MovementRowPresentation.subtitle(
                    for: transaction,
                    lineName: Formatters.dayMonthLabel(for: transaction.transactionDate)
                ) ?? "")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)

                // Where an income drawn from a savings goal came from (PUL-329) —
                // the same metadata line as the date and the tag count.
                if let source = transaction.savingsGoalSource {
                    SavingsGoalSourceLabel(source: source, followsText: true)
                }

                if !tagNames.isEmpty {
                    TagChips(names: tagNames, presentation: .count, followsText: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var amountColumn: some View {
        Text(MovementRowPresentation.amountText(for: transaction, in: currency))
            .font(PulpeTypography.rowAmount)
            .foregroundStyle(Color.textPrimary)
            .lineLimit(1)
            .sensitiveAmount()
            .layoutPriority(1)
    }
}
