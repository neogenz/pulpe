import SwiftUI

/// Tour 11 "opérations à pointer" — header summary (stacked kind avatars + totals)
/// plus an inline quick-check of one operation: "C'est passé" / "Plus tard".
struct UncheckedOperationsCard: View {
    let items: [CurrentMonthStore.CheckableItem]
    let totalCount: Int
    var tagNamesById: [String: String] = [:]
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    var onToggle: (CurrentMonthStore.CheckableItem) -> Void
    var onViewAll: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var skippedIds: Set<String> = []
    @State private var checkTrigger = false
    @State private var skipTrigger = false
    /// The operation currently showing its local "Pointé" confirmation, held from the tap
    /// until the store drops it — the round-trip is too slow to be the only acknowledgement.
    @State private var confirmingId: String?

    /// SwiftUI removes a view with the transition captured at its LAST render, not the one
    /// computed alongside the removal — so an exit direction stored in a flag flipped in the
    /// same transaction arrives one animation late. The only removal-time signal that is
    /// always fresh is the pane's own confirmation state: `confirmingId` is committed one
    /// beat before a check's removal and nil otherwise.
    ///
    /// Vocabulary: every new operation arrives the same way (slides in from leading — next
    /// in the queue). Only the exit differs, and it depends solely on what was done to THIS
    /// item: confirmed resolves upward and settles; deferred slides out to trailing.
    private func paneTransition(for item: CurrentMonthStore.CheckableItem) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        let insertion = AnyTransition.opacity.combined(with: .move(edge: .leading))
        if confirmingId == item.id {
            return .asymmetric(
                insertion: insertion,
                removal: .opacity.combined(with: .push(from: .bottom))
                    .combined(with: .scale(scale: DesignTokens.Animation.settleScale))
            )
        }
        return .asymmetric(
            insertion: insertion,
            removal: .opacity.combined(with: .move(edge: .trailing))
        )
    }

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
        "\(totalCount) opération\(totalCount > 1 ? "s" : "") à pointer"
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

                inlinePane(item)
                    .id(item.id)
                    .transition(paneTransition(for: item))
            }
        }
        .animation(
            reduceMotion ? DesignTokens.Animation.smoothEaseOut : DesignTokens.Animation.gentleSpring,
            value: currentItem?.id
        )
        .sensoryFeedback(.success, trigger: checkTrigger)
        .sensoryFeedback(.selection, trigger: skipTrigger)
        .onChange(of: currentItem?.id) { _, _ in
            // The next operation must start from a clean slate, not inherit the confirmation.
            confirmingId = nil
        }
    }

    // MARK: - Header

    private var header: some View {
        // Flat ledger: the title starts on the same rail as the rows beneath it, so the
        // decorative avatars move to the trailing cluster rather than indenting the section.
        HStack(spacing: DesignTokens.Spacing.lg) {
            Text("\(totalCount) opération\(totalCount > 1 ? "s" : "") à pointer")
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            if dynamicTypeSize < .xxLarge {
                avatarStack
            }

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)
        }
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
                // The ring punches the badge out of the ground it actually sits on — the flat
                // ledger, not the card surface that used to be behind it.
                Circle().strokeBorder(
                    Color.homeBackground,
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
                // The ring punches the badge out of the ground it actually sits on — the flat
                // ledger, not the card surface that used to be behind it.
                Circle().strokeBorder(
                    Color.homeBackground,
                    lineWidth: DesignTokens.BorderWidth.thick
                )
            }
    }

    // MARK: - Inline Quick-Check

    private func inlinePane(_ item: CurrentMonthStore.CheckableItem) -> some View {
        let tagNames = tagNames(for: item)

        return VStack(spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                (
                    Text(item.name)
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textPrimary)
                    + Text(metadataText(for: item))
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)
                )
                .lineLimit(1)

                if !tagNames.isEmpty {
                    TagChips(names: tagNames, presentation: .count, followsText: true)
                }

                Spacer()

                // The name beside it is pinned to one line; without a matching constraint
                // the amount wraps ("-400.0" / "0") and shoves the name into truncation.
                Text(amountText(for: item))
                    .font(PulpeTypography.amountMedium)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
                    .sensitiveAmount()
            }
            .accessibilityElement(children: .combine)

            actionsRow(item)
        }
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .opacity(isSyncing(item) ? DesignTokens.Opacity.disabled : 1)
    }

    @ViewBuilder
    private func actionsRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        // Side by side, "C'est passé" and "Plus tard" squeeze each other once the labels
        // grow; stacked, each keeps its full width and its 44pt target.
        if dynamicTypeSize >= .xxLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                confirmButton(item)
                skipButton(item)
            }
        } else {
            HStack(spacing: DesignTokens.Spacing.lg) {
                confirmButton(item)
                Spacer(minLength: DesignTokens.Spacing.sm)
                skipButton(item)
            }
        }
    }

    private func confirmButton(_ item: CurrentMonthStore.CheckableItem) -> some View {
        let isConfirming = confirmingId == item.id

        return Button {
            guard confirmingId == nil else { return }
            checkTrigger.toggle()
            // Beat one: the capsule commits to solid green immediately, so the tap is
            // acknowledged now rather than whenever the network answers.
            withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) {
                confirmingId = item.id
            }
            // Beat two: the store drops the item and the pane resolves upward.
            onToggle(item)
        } label: {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                Image(systemName: isConfirming ? "checkmark.circle.fill" : "checkmark")
                    .font(PulpeTypography.metricLabelBold)
                    .contentTransition(.symbolEffect(.replace))
                Text(isConfirming ? "Pointé" : "C'est passé")
                    .font(PulpeTypography.labelLarge)
                    .contentTransition(.opacity)
            }
            .foregroundStyle(isConfirming ? Color.textOnPrimary : Color.pulpePrimary)
            // Height comes from padding, not from the tap-target floor — putting
            // `minHeight` in the label would make the capsule's size an artifact of
            // the 44pt rule rather than a deliberate visual.
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(
                isConfirming
                    ? AnyShapeStyle(Color.pulpePrimary)
                    : AnyShapeStyle(Color.pulpePrimary.opacity(DesignTokens.Opacity.highlightBackground)),
                in: Capsule()
            )
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .disabled(isSyncing(item) || confirmingId != nil)
        .accessibilityLabel("Pointer \(item.name)")
    }

    private func skipButton(_ item: CurrentMonthStore.CheckableItem) -> some View {
        Button {
            guard confirmingId == nil else { return }
            skipTrigger.toggle()
            withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) {
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
                .foregroundStyle(Color.textSecondary)
        }
        // `textLinkButtonStyle` deliberately forces no height, and this button's row
        // provides no padding of its own — without an explicit floor the target is ~20pt.
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .textLinkButtonStyle()
        // During the "Pointé" beat the guard already ignores taps; without the visual
        // disable the button looks live and silently does nothing.
        .disabled(confirmingId != nil)
        .opacity(confirmingId != nil ? DesignTokens.Opacity.disabled : 1)
        .accessibilityLabel("Plus tard pour \(item.name)")
    }

    private func subtitle(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        case .transaction(let transaction, _):
            transaction.transactionDate.relativeFormatted.lowercased()
        case .budgetLine(let line, _):
            line.recurrence.label.lowercased()
        }
    }

    private func tagNames(for item: CurrentMonthStore.CheckableItem) -> [String] {
        switch item {
        case .transaction(let transaction, _):
            TagChips.names(for: transaction.tagIds, namesById: tagNamesById)
        case .budgetLine(let line, _):
            TagChips.names(for: line.tagIds, namesById: tagNamesById)
        }
    }

    private func metadataText(for item: CurrentMonthStore.CheckableItem) -> String {
        let tagCount = tagNames(for: item).count
        guard tagCount > 0 else { return " · \(subtitle(for: item))" }
        return " · \(subtitle(for: item)) · \(tagCount) tag\(tagCount > 1 ? "s" : "")"
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
