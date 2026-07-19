import SwiftUI

/// Tour 11 "opérations à pointer" — header summary (stacked kind avatars + totals)
/// plus an inline quick-check of one operation: "C'est passé" / "Plus tard".
struct UncheckedOperationsCard: View {
    let items: [CurrentMonthStore.CheckableItem]
    let totalCount: Int
    let totalAmount: Decimal
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    var onToggle: (CurrentMonthStore.CheckableItem) -> Void
    var onViewAll: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @State private var skippedIds: Set<String> = []
    @State private var checkTrigger = false

    private var currency: SupportedCurrency { userSettingsStore.currency }

    /// The operation currently offered for inline check — first one not skipped via "Plus tard".
    /// Falls back to the first item when every live item has been skipped, so pointing an
    /// operation while others are skipped can never strand the pane hidden while ops remain.
    private var currentItem: CurrentMonthStore.CheckableItem? {
        items.first { !skippedIds.contains($0.id) } ?? items.first
    }

    private func isSyncing(_ item: CurrentMonthStore.CheckableItem) -> Bool {
        switch item {
        case .transaction(let transaction, _): syncingTransactionIds.contains(transaction.id)
        case .budgetLine(let line, _): syncingBudgetLineIds.contains(line.id)
        }
    }

    private var headerAccessibilityLabel: String {
        let count = "\(totalCount) opération\(totalCount > 1 ? "s" : "") à pointer"
        guard !amountsHidden else { return "\(count) — montant masqué" }
        return "\(count), \(totalAmount.asCompactCurrency(currency)) à réconcilier"
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            Button(action: onViewAll) {
                header
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel(headerAccessibilityLabel)
            .accessibilityHint("Voir tout dans le budget")

            if let item = currentItem {
                Divider()
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                inlinePane(item)
            }
        }
        .pulpeCardBackground()
        .shadow(DesignTokens.Shadow.card)
        .animation(DesignTokens.Animation.defaultSpring, value: currentItem?.id)
        .sensoryFeedback(.success, trigger: checkTrigger)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            avatarStack

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("\(totalCount) opération\(totalCount > 1 ? "s" : "") à pointer")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)

                Text("\(totalAmount.asCompactCurrency(currency)) à réconcilier")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.lg)
    }

    private var avatarStack: some View {
        HStack(spacing: -DesignTokens.Spacing.compactGap) {
            ForEach(Array(items.prefix(2).enumerated()), id: \.offset) { _, item in
                kindCircle(item.kind)
            }
            if totalCount > 2 {
                overflowCircle(totalCount - 2)
            }
        }
        .accessibilityHidden(true)
    }

    private func kindCircle(_ kind: TransactionKind) -> some View {
        Circle()
            .fill(kind.color.opacity(DesignTokens.Opacity.accent))
            .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
            .overlay {
                Image(systemName: kind.icon)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(kind.color)
            }
            .overlay {
                Circle().strokeBorder(
                    Color.surfaceContainerLowest,
                    lineWidth: DesignTokens.BorderWidth.thick
                )
            }
    }

    private func overflowCircle(_ count: Int) -> some View {
        Circle()
            .fill(Color.surfaceContainerHigh)
            .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
            .overlay {
                Text("+\(count)")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }
            .overlay {
                Circle().strokeBorder(
                    Color.surfaceContainerLowest,
                    lineWidth: DesignTokens.BorderWidth.thick
                )
            }
    }

    // MARK: - Inline Quick-Check

    private func inlinePane(_ item: CurrentMonthStore.CheckableItem) -> some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                (
                    Text(item.name)
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textPrimary)
                    + Text(" · \(subtitle(for: item))")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)
                )
                .lineLimit(1)

                Spacer()

                Text(amountText(for: item))
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            actionsRow(item)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .opacity(isSyncing(item) ? DesignTokens.Opacity.disabled : 1)
    }

    private func actionsRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            Button {
                checkTrigger.toggle()
                onToggle(item)
            } label: {
                HStack(spacing: DesignTokens.Spacing.tightGap) {
                    Image(systemName: "checkmark")
                        .font(PulpeTypography.metricLabelBold)
                    Text("C'est passé")
                        .font(PulpeTypography.labelLarge)
                }
                .foregroundStyle(Color.pulpePrimary)
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
                .background(
                    Color.pulpePrimary.opacity(DesignTokens.Opacity.highlightBackground),
                    in: Capsule()
                )
            }
            .contentShape(Capsule())
            .plainPressedButtonStyle()
            .disabled(isSyncing(item))
            .accessibilityLabel("Pointer \(item.name)")

            Button {
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    _ = skippedIds.insert(item.id)
                    // Wrap around: once every item has been skipped, restart the
                    // rotation so the inline pane keeps offering operations to point
                    // instead of vanishing while some are still "à pointer".
                    if items.allSatisfy({ skippedIds.contains($0.id) }) {
                        skippedIds.removeAll()
                    }
                }
            } label: {
                Text("Plus tard")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textTertiary)
            }
            .textLinkButtonStyle()
            .accessibilityLabel("Plus tard pour \(item.name)")
        }
    }

    private func subtitle(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        case .transaction(let transaction, _):
            transaction.transactionDate.relativeFormatted.lowercased()
        case .budgetLine(let line, _):
            line.recurrence.label.lowercased()
        }
    }

    private func amountText(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        case .transaction(let transaction, _):
            transaction.amount.asSignedAmount(for: transaction.kind, in: currency)
        case .budgetLine(let line, _):
            line.amount.asSignedAmount(for: line.kind, in: currency)
        }
    }
}
