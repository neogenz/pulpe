import SwiftUI

/// Tour 11 "opérations à pointer" — the section heading on the page, and under it a
/// deck of quick-check cards, one operation per card: "C'est passé" / "Plus tard".
/// The neighbouring cards peek at the screen edges as tickets tucked behind the focused
/// one, so the deck reads as swipeable without a single affordance drawn on it.
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
    @State private var checkTrigger = false
    @State private var skipTrigger = false
    /// Deck position — nil until the first turn, meaning the first card.
    @State private var scrolledId: String?
    /// Where the deck should land once the confirmed card leaves the store, computed at
    /// tap time while the confirmed card still anchors the order.
    @State private var successorId: String?
    /// The operation currently showing its local "Pointé" confirmation, held from the tap
    /// until the store drops it — the round-trip is too slow to be the only acknowledgement.
    @State private var confirmingId: String?

    /// SwiftUI removes a view with the transition captured at its LAST render, not the one
    /// computed alongside the removal — so an exit direction stored in a flag flipped in the
    /// same transaction arrives one animation late. The only removal-time signal that is
    /// always fresh is the card's own confirmation state: `confirmingId` is committed one
    /// beat before a check's removal and nil otherwise. Confirmed resolves upward and
    /// settles; any other arrival or removal (a refresh reshuffling the list) fades, the
    /// deck's own slide carrying the motion.
    private func paneTransition(for item: CurrentMonthStore.CheckableItem) -> AnyTransition {
        guard !reduceMotion, confirmingId == item.id else { return .opacity }
        return .asymmetric(
            insertion: .opacity,
            removal: .opacity.combined(with: .push(from: .bottom))
                .combined(with: .scale(scale: DesignTokens.Animation.settleScale))
        )
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    /// The card the deck is resting on — the only one whose buttons answer taps.
    private var focusedId: String? { scrolledId ?? items.first?.id }

    private var deckAnimation: SwiftUI.Animation {
        reduceMotion ? DesignTokens.Animation.smoothEaseOut : DesignTokens.Animation.gentleSpring
    }

    /// The card after this one in the deck, wrapping past the end so "Plus tard" keeps
    /// offering operations for as long as any remain unchecked.
    private func nextId(after item: CurrentMonthStore.CheckableItem) -> String? {
        guard let idx = items.firstIndex(where: { $0.id == item.id }) else { return items.first?.id }
        return items[(idx + 1) % items.count].id
    }

    private func isSyncing(_ item: CurrentMonthStore.CheckableItem) -> Bool {
        switch item {
        case .transaction(let transaction, _): syncingTransactionIds.contains(transaction.id)
        case .budgetLine(let line, _): syncingBudgetLineIds.contains(line.id)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // The count lives on the hero metric; this heading names the section only,
            // so the number is announced once per screen.
            HomeSectionHeader(
                title: "Opérations à pointer",
                link: (label: "Tout voir", action: onViewAll)
            )

            deck
        }
        .sensoryFeedback(.success, trigger: checkTrigger)
        .sensoryFeedback(.selection, trigger: skipTrigger)
        .onChange(of: items.map(\.id)) { _, newIds in
            // The confirmed card left the store: land the deck on its successor so the
            // next operation clicks into the focus slot instead of leaving a hole, and
            // start it from a clean slate rather than inheriting the confirmation.
            if let focused = focusedId, !newIds.contains(focused) {
                withAnimation(deckAnimation) {
                    scrolledId = successorId ?? newIds.first
                }
            }
            successorId = nil
            confirmingId = nil
        }
    }

    // MARK: - Deck

    /// The page hangs everything on one rail (the `Spacing.xxl` content margin applied
    /// by CurrentMonthView). A deck can only peek if it escapes that rail: it cancels
    /// the margin, runs full-bleed, and re-applies the same token as a scroll content
    /// margin — the focused card sits exactly on the rail while its neighbours own the
    /// edges. A plain HStack, not lazy: removal transitions don't play inside lazy
    /// containers, and the list is at most a month's unchecked operations.
    private var deck: some View {
        ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(items) { item in
                    inlinePane(item)
                        .pulpeRowCard()
                        .containerRelativeFrame(.horizontal)
                        .scrollTransition(.interactive, axis: .horizontal) { content, phase in
                            // Tucked neighbours: scale AND turn both pivot on the inner
                            // edge — the peek width survives the shrink, and the 3D
                            // projection grows toward the screen edge instead of
                            // swelling inward over the focused card. Under Reduce
                            // Motion the turn goes; scale and fade are resting states
                            // that only track the user's own finger.
                            let depth = abs(phase.value)
                            let innerEdge: UnitPoint = phase.value > 0 ? .leading : .trailing
                            return content
                                .scaleEffect(
                                    1 - depth * DesignTokens.Deck.tuckScaleDrop,
                                    anchor: innerEdge
                                )
                                .rotation3DEffect(
                                    .degrees(reduceMotion ? 0 : phase.value * DesignTokens.Deck.turnDegrees),
                                    axis: (x: 0, y: 1, z: 0),
                                    anchor: innerEdge
                                )
                                .opacity(1 - depth * DesignTokens.Deck.tuckFade)
                        }
                        // An HStack paints later siblings on top, so the trailing
                        // neighbour — its shadow and its perspective projection — would
                        // ride over the focused card. The focused card owns the top
                        // layer; behind it the natural order keeps each billet under
                        // the one nearer the focus.
                        .zIndex(item.id == focusedId ? 1 : 0)
                        // Only the focused card answers taps: a peeking sliver exposes
                        // the leading edge of its neighbour's own "C'est passé", and one
                        // stray tap there would point an operation the user barely sees.
                        // VoiceOver still reaches every card — hit testing gates touch,
                        // not accessibility activation.
                        .allowsHitTesting(item.id == focusedId)
                        .transition(paneTransition(for: item))
                }
            }
            .scrollTargetLayout()
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.xxl, for: .scrollContent)
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: $scrolledId)
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .padding(.horizontal, -DesignTokens.Spacing.xxl)
        .animation(deckAnimation, value: items.map(\.id))
    }

    // MARK: - Inline Quick-Check

    private func inlinePane(_ item: CurrentMonthStore.CheckableItem) -> some View {
        // Leading, not the default centre: side by side both rows carry a `Spacer` and fill
        // the width, so the alignment never showed. Stacked, the two chips are narrower
        // than the pane and drift to the middle, off the rail the whole ledger hangs from.
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            operationRow(item)

            // Bounded by the card, a rule says one thing only: above it is what the two
            // actions act on, below it are the actions. The rules this screen dropped
            // were drawn on the bare page, where nothing declared what they divided.
            Divider()

            actionsRow(item)
        }
        .padding(DesignTokens.Spacing.lg)
        .opacity(isSyncing(item) ? DesignTokens.Opacity.disabled : 1)
    }

    private func operationRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        // Opposite ends while the row can hold both. Past `xxLarge` it cannot, and the
        // one-line rule that keeps the amount from wrapping is what cuts the label down
        // to "Logement…". Stacked, each owns the width and the rule protects nothing.
        let isStacked = dynamicTypeSize >= .xxLarge

        return HStack(spacing: DesignTokens.Spacing.lg) {
            RowIcon(systemName: item.kind.icon, tint: item.kind.color)

            if isStacked {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    operationLabel(item, isStacked: true)
                    tagChips(item, isStacked: true)
                    operationAmount(item)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                operationLabel(item, isStacked: false)

                tagChips(item, isStacked: false)

                Spacer(minLength: DesignTokens.Spacing.sm)

                operationAmount(item)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// Trails the label while the row holds both; stacked it takes the line under it,
    /// where a chip that followed a wrapped label would sit alone at the end of a
    /// half-empty line. The separator goes with that move: it exists to join the count
    /// to text already on its line, and there is none to join once the count has a line
    /// of its own.
    @ViewBuilder
    private func tagChips(_ item: CurrentMonthStore.CheckableItem, isStacked: Bool) -> some View {
        let names = tagNames(for: item)
        if !names.isEmpty {
            TagChips(names: names, presentation: .count, followsText: !isStacked)
        }
    }

    private func operationLabel(
        _ item: CurrentMonthStore.CheckableItem,
        isStacked: Bool
    ) -> some View {
        // Two Texts, not one concatenation: with a disc opening the row, the name owns
        // the first line and its metadata sits under it, the way every other row on the
        // screen is built. Concatenated, the metadata was also the first thing truncated.
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(item.name)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(isStacked ? nil : 1)

            Text(subtitle(for: item))
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .lineLimit(isStacked ? nil : 1)
        }
    }

    private func operationAmount(_ item: CurrentMonthStore.CheckableItem) -> some View {
        Text(amountText(for: item))
            .font(PulpeTypography.amountMedium)
            .foregroundStyle(Color.textPrimary)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.compact)
            .sensitiveAmount()
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
            // Adjacent, both on the leading rail. Pushed to opposite ends of the card they
            // read as two unrelated controls that happen to share a row; side by side they
            // read as one question with two answers, the affirmative first.
            HStack(spacing: DesignTokens.Spacing.md) {
                confirmButton(item)
                skipButton(item)
                Spacer(minLength: DesignTokens.Spacing.none)
            }
        }
    }

    private func confirmButton(_ item: CurrentMonthStore.CheckableItem) -> some View {
        let isConfirming = confirmingId == item.id

        return Button {
            guard confirmingId == nil else { return }
            checkTrigger.toggle()
            // Where the deck lands once the store drops this card: the operation that
            // was next in line, or the new last card when the last one was confirmed.
            let rest = items.filter { $0.id != item.id }
            if let idx = items.firstIndex(where: { $0.id == item.id }), !rest.isEmpty {
                successorId = rest[min(idx, rest.count - 1)].id
            } else {
                successorId = nil
            }
            // Beat one: the capsule commits to solid green immediately, so the tap is
            // acknowledged now rather than whenever the network answers.
            withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) {
                confirmingId = item.id
            }
            // Beat two: the store drops the item and the card resolves upward.
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
            // "Plus tard" is a turn of the deck: the card stays in the rotation and the
            // deck advances to the next one — the same move a swipe makes, kept as a
            // button so the choice stays explicit and reachable without the gesture.
            withAnimation(deckAnimation) {
                scrolledId = nextId(after: item)
            }
        } label: {
            // A bounded shape, not bare grey text. Two boxes of one size read as the two
            // terms of a choice; text alone at the far end of a row read as a caption that
            // happened to be right-aligned. `.muted` gives it a fill of its own — `.outlined`
            // draws a hairline meant for `appBackground`, which a card of the same
            // `surfaceContainerLowest` tone swallows at 1,00:1.
            PulpeChip(
                label: "Plus tard",
                style: .muted,
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

    private func amountText(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        case .transaction(let transaction, _):
            transaction.amount.asSignedAmount(for: transaction.kind, in: currency)
        case .budgetLine(let line, _):
            line.amount.asSignedAmount(for: line.kind, in: currency)
        }
    }
}
