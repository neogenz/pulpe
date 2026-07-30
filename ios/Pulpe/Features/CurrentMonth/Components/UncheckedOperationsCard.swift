import SwiftUI

/// Tour 11 "opérations à pointer" — header summary (stacked kind avatars + totals)
/// plus an inline quick-check of one operation: "C'est passé" / "Plus tard".
struct UncheckedOperationsCard: View {
    let items: [CurrentMonthStore.CheckableItem]
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

    /// The count lives on the hero metric; this header names the section only, so the
    /// number is announced once per screen.
    private var headerAccessibilityLabel: String { "Opérations à pointer" }

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
        // Flat ledger: the title starts on the same rail as the rows beneath it. The stack of
        // kind avatars that used to sit before the chevron is gone: it restated a count the
        // hero already carries, and two glyphs competing for the trailing slot made neither
        // of them read as the way into the budget.
        HStack(spacing: DesignTokens.Spacing.lg) {
            Text("Opérations à pointer")
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)
        }
        // Asymmetric on purpose: the heading is pushed away from the section above it and
        // held close to the operation it introduces, so proximity alone groups them.
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
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
            // The capsule this used to hand-roll was `ChipMetrics.Standard` rewritten by
            // hand, padding for padding. Going through the shared chip is what lets the
            // two actions below be measured by one ruler instead of two.
            PulpeChip(
                icon: isConfirming ? "checkmark.circle.fill" : "checkmark",
                label: isConfirming ? "Pointé" : "C'est passé",
                style: isConfirming
                    ? .tinted(surface: .pulpePrimary, foreground: .textOnPrimary)
                    : .semantic(.pulpePrimary)
            )
        }
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
            // A bounded shape, not bare grey text. Two boxes of one size read as the two
            // terms of a choice; text alone at the far end of a row read as a caption that
            // happened to be right-aligned. The outline against the filled affirmative is
            // the language the period selector further down already speaks.
            PulpeChip(
                label: "Plus tard",
                style: .outlined,
                // During the "Pointé" beat the guard already ignores taps; without the
                // visual disable the button looks live and silently does nothing.
                isDisabled: confirmingId != nil
            )
        }
        .plainPressedButtonStyle()
        .disabled(confirmingId != nil)
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
