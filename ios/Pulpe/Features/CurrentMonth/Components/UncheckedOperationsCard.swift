import SwiftUI

/// Tour 11 "opérations à pointer": a cyclic deck of quick-check cards whose neighbours
/// peek at the screen edges to make swiping discoverable.
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
    /// The slot the deck is resting on or heading to — derived from scroll geometry on
    /// every tick, so it stays honest even between two alignments.
    @State private var scrolledId: String?
    /// Programmatic handle on the scroll: the turns, the appear seed, and the exact
    /// one-cycle offset shifts that keep the loop endless.
    @State private var position = ScrollPosition(idType: String.self)
    /// Where the deck should land once the confirmed card leaves the store, computed at
    /// tap time while the confirmed card still anchors the order. Confirming the last
    /// card targets the wrap copy of the first, so the handover keeps turning forward.
    @State private var successorId: String?
    /// The operation currently showing its local "Pointé" confirmation, held from the tap
    /// until its exit animation completes — the round-trip is too slow to be the only
    /// acknowledgement, and the exiting card keeps the top layer for as long as it is set.
    @State private var confirmingId: String?
    /// A "Plus tard" turn in flight. Spam-clicks used to pile animated scroll targets on
    /// top of each other until they cancelled out and the deck froze between two cards.
    @State private var isTurning = false
    /// Mirror of `items`, one commit behind the store. The deck renders from it because
    /// owning the removal locally is what puts the confirmed card's exit and the deck's
    /// slide to the successor in a single animated transaction — dropped straight from
    /// `items`, the ScrollView resolves the vanished scroll target instantly and the
    /// closing animation is cut.
    @State private var displayItems: [CurrentMonthStore.CheckableItem]

    init(
        items: [CurrentMonthStore.CheckableItem],
        tagNamesById: [String: String] = [:],
        syncingBudgetLineIds: Set<String>,
        syncingTransactionIds: Set<String>,
        onToggle: @escaping (CurrentMonthStore.CheckableItem) -> Void,
        onViewAll: @escaping () -> Void
    ) {
        self.items = items
        self.tagNamesById = tagNamesById
        self.syncingBudgetLineIds = syncingBudgetLineIds
        self.syncingTransactionIds = syncingTransactionIds
        self.onToggle = onToggle
        self.onViewAll = onViewAll
        _displayItems = State(initialValue: items)
    }

    /// What the deck shows: membership and order owned by `displayItems` (so an exiting
    /// card survives its transition), values refreshed from the store on every render.
    private var deckItems: [CurrentMonthStore.CheckableItem] {
        displayItems.map { shown in items.first { $0.id == shown.id } ?? shown }
    }

    /// Every operation under its own id, framed by a full cycle copy on each side.
    /// `handleScrollGeometry` shifts by one cycle mid-scroll to close the loop invisibly.
    private var deckSlots: [DeckSlot] {
        let cards = deckItems
        guard cards.count > 1 else { return cards.map(DeckSlot.init(real:)) }
        let before = cards.map { DeckSlot(wrapCopyOf: $0, past: .leading) }
        let after = cards.map { DeckSlot(wrapCopyOf: $0, past: .trailing) }
        return before + cards.map(DeckSlot.init(real:)) + after
    }

    /// SwiftUI captures a removal transition at the view's last render, so `confirmingId`
    /// is committed one beat before removal. Confirmed cards resolve upward; refresh-driven
    /// arrivals and removals fade while the deck carries the motion.
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
    private var focusedId: String? { scrolledId ?? displayItems.first?.id }

    private var deckAnimation: SwiftUI.Animation {
        reduceMotion ? DesignTokens.Animation.smoothEaseOut : DesignTokens.Animation.gentleSpring
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
            SectionHeader(
                title: AppLocale.string("Opérations à pointer"),
                link: (label: AppLocale.string("Tout voir"), action: onViewAll)
            )

            deck
        }
        .sensoryFeedback(.success, trigger: checkTrigger)
        .sensoryFeedback(.selection, trigger: skipTrigger)
        .onChange(of: items.map(\.id)) { _, newIds in
            // One transaction for the whole handover: the confirmed card plays its exit
            // (it only leaves `displayItems` here, inside the animation) while the deck
            // slides its successor into the focus slot. `confirmingId` survives until
            // the exit completes so the closing card keeps the top layer and the
            // buttons stay quiet, then the next card starts from a clean slate.
            seedPositionIfNeeded(first: newIds.first)
            withAnimation(deckAnimation) {
                if let focused = focusedId, !newIds.contains(focused),
                   let target = successorId ?? newIds.first {
                    position.scrollTo(id: target)
                }
                displayItems = items
            } completion: {
                settleScrolledId()
                successorId = nil
                confirmingId = nil
            }
        }
        // `.contain` scopes the identifier to a container node; bare, it would
        // propagate onto every child and clobber the rows' own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeUncheckedOperationsCard")
    }

    // MARK: - Deck

    /// The page hangs everything on one rail (the `Spacing.xxl` content margin applied
    /// by CurrentMonthView). A deck can only peek if it escapes that rail: it cancels
    /// the margin, runs full-bleed, and re-applies the same token as a scroll content
    /// margin — the focused card sits exactly on the rail while its neighbours own the
    /// edges. A plain HStack, not lazy: removal transitions don't play inside lazy
    /// containers, and the list is at most a month's unchecked operations.
    private var deck: some View {
        let reduceDeckMotion = reduceMotion
        return ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(deckSlots) { slot in
                    inlinePane(slot.item)
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
                                    .degrees(reduceDeckMotion ? 0 : phase.value * DesignTokens.Deck.turnDegrees),
                                    axis: (x: 0, y: 1, z: 0),
                                    anchor: innerEdge
                                )
                                .opacity(1 - depth * DesignTokens.Deck.tuckFade)
                        }
                        // An HStack paints later siblings on top, so the trailing
                        // neighbour — its shadow and its perspective projection — would
                        // ride over the focused card. The focused card owns the top
                        // layer (and a card playing its confirmed exit keeps it, so it
                        // closes above the successor sliding in); behind it the natural
                        // order keeps each billet under the one nearer the focus.
                        .zIndex(slot.id == focusedId || (slot.isReal && slot.item.id == confirmingId) ? 1 : 0)
                        // Only the focused card answers taps: a peeking sliver exposes
                        // the leading edge of its neighbour's own "C'est passé", and one
                        // stray tap there would point an operation the user barely sees.
                        // VoiceOver still reaches every real card — hit testing gates
                        // touch, not accessibility activation — and skips the wrap
                        // copies, which would read as duplicates.
                        .allowsHitTesting(slot.isReal && slot.id == focusedId)
                        .accessibilityHidden(!slot.isReal)
                        .transition(slot.isReal ? paneTransition(for: slot.item) : .opacity)
                }
            }
            .scrollTargetLayout()
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.xxl, for: .scrollContent)
        // One turn per gesture: a flick advances one card, so a run of flicks spends
        // the wrap runway one slot at a time instead of leaping through it.
        .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
        .scrollPosition($position)
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        // Untouchable mid-turn: a touch stops the programmatic scroll dead between slots.
        .allowsHitTesting(confirmingId == nil && !isTurning)
        .onScrollGeometryChange(for: [CGFloat].self) { geo in
            [geo.visibleRect.midX, geo.contentSize.width, geo.contentOffset.x]
        } action: { _, values in
            handleScrollGeometry(midX: values[0], contentWidth: values[1], offsetX: values[2])
        }
        // The turn guard is released here: `withAnimation`'s completion doesn't track
        // scroll animations and fires at once, letting a second tap kill both turns.
        .onScrollPhaseChange { _, newPhase in
            guard newPhase == .idle else { return }
            isTurning = false
            settleScrolledId()
        }
        // Seeded here too: an initial position value performs no scroll and left the deck
        // at offset zero, on a wrap copy with dead buttons and no left peek.
        .onAppear {
            seedPositionIfNeeded(first: displayItems.first?.id)
        }
        .padding(.horizontal, -DesignTokens.Spacing.xxl)
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
        .accessibilityIdentifier("homeUncheckedOperationRow")
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
            guard confirmingId == nil, !isTurning else { return }
            checkTrigger.toggle()
            // Where the deck lands once the store drops this card: the operation that
            // was next in line. Confirming the last card targets the wrap copy of the
            // first, so the handover turns forward — the same way the deck does.
            successorId = DeckCycle.successorId(after: item.id, in: displayItems.map(\.id))
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
                label: isConfirming ? AppLocale.string("Pointé") : AppLocale.string("C'est passé"),
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
            guard confirmingId == nil, !isTurning else { return }
            skipTrigger.toggle()
            // "Plus tard" is a turn of the deck: the card stays in the rotation and the
            // deck advances to the next one — the same move a swipe makes, kept as a
            // button so the choice stays explicit and reachable without the gesture.
            advance(after: item)
        } label: {
            // A bounded shape, not bare grey text. Two boxes of one size read as the two
            // terms of a choice; text alone at the far end of a row read as a caption that
            // happened to be right-aligned. `.muted` gives it a fill of its own — `.outlined`
            // draws a hairline meant for `appBackground`, which a card of the same
            // `surfaceContainerLowest` tone swallows at 1,00:1.
            PulpeChip(
                label: AppLocale.string("Plus tard"),
                style: .muted,
                // Dead with one card left (nothing to turn to) or during the "Pointé" beat
                // (guard already ignores taps); without the visual disable it looks live.
                isDisabled: confirmingId != nil || displayItems.count <= 1
            )
        }
        .plainPressedButtonStyle()
        .disabled(confirmingId != nil || displayItems.count <= 1)
        .accessibilityLabel("Plus tard pour \(item.name)")
    }

    private func subtitle(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        // No `.lowercased()`: German capitalizes nouns ("Heute", "Montag") and English its
        // weekdays, and every other date subtitle in the app already renders capitalized.
        case .transaction(let transaction, _):
            transaction.transactionDate.relativeFormatted
        case .budgetLine(let line, _):
            line.recurrence.label
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

// MARK: - Cycle Mechanics

private extension UncheckedOperationsCard {
    /// Seeds the scroll position once — called from both `.onChange` and `.onAppear` below.
    func seedPositionIfNeeded(first: String?) {
        guard scrolledId == nil, let first else { return }
        scrolledId = first
        position.scrollTo(id: first)
    }

    /// Canonicalizes `scrolledId` once a transition or scroll settles: at rest on a wrap
    /// copy, it rebases onto the real card that copy mirrors — same content, same peeks,
    /// nothing moves on screen. A real id the 2 → 1 collapse orphaned (no slot left to
    /// answer to, `DeckCycle.reconciledScrolledId`) falls back to the deck's first card.
    func settleScrolledId() {
        guard let current = scrolledId else { return }
        let next = DeckSlot.realId(fromWrapId: current)
            ?? DeckCycle.reconciledScrolledId(current: current, ids: displayItems.map(\.id))
        guard next != current else { return }
        scrolledId = next
        if let next { position.scrollTo(id: next) }
    }

    /// The endless half of the loop, run on every scroll tick. The content is three identical
    /// cycles side by side, so sliding the offset by exactly one cycle width shows the exact
    /// same pixels: whenever the scroll sinks half a cycle into either wrap zone — mid-flight
    /// included — it is slid one cycle back toward the middle, and the runway never ends. The
    /// focused slot falls out of the same geometry, as the slot under the viewport's centre;
    /// one card has no cycle to recentre but still needs its focus tracked, below.
    func handleScrollGeometry(midX: CGFloat, contentWidth: CGFloat, offsetX: CGFloat) {
        let cardIds = displayItems.map(\.id)
        guard let onlyId = cardIds.first else { return }
        guard cardIds.count > 1 else {
            if onlyId != scrolledId { scrolledId = onlyId }
            return
        }
        guard contentWidth > 0 else { return }
        // Assumes `contentSize.width` excludes the `contentMargins(.horizontal, Spacing.xxl)` below;
        // if wrong, `slotSpan` drifts by `2·xxl / (3N)` per slot — harmless only because
        // `uncheckedItems` caps at 5 (`CurrentMonthStore.maxDashboardItems`).
        let slotSpan = (contentWidth + DesignTokens.Spacing.xs) / CGFloat(cardIds.count * 3)
        let cycleWidth = slotSpan * CGFloat(cardIds.count)
        let index = min(max(0, Int(midX / slotSpan)), cardIds.count * 3 - 1)
        let focused = DeckCycle.focusedId(atFlatIndex: index, cards: cardIds)
        if focused != scrolledId { scrolledId = focused }
        if midX < cycleWidth * 0.5 {
            position.scrollTo(x: offsetX + cycleWidth)
        } else if midX > cycleWidth * 2.5 {
            position.scrollTo(x: offsetX - cycleWidth)
        }
    }

    /// One turn of the deck forward — the move a swipe makes. On the last card the turn
    /// continues onto the wrap copy of the first, then rebases: the cycle never plays
    /// the deck backwards.
    func advance(after item: CurrentMonthStore.CheckableItem) {
        guard displayItems.count > 1,
              let idx = displayItems.firstIndex(where: { $0.id == item.id }) else { return }
        let target = idx == displayItems.count - 1
            ? DeckSlot.wrapId(for: displayItems[0].id, at: .trailing)
            : displayItems[idx + 1].id
        isTurning = true
        withAnimation(deckAnimation) {
            position.scrollTo(id: target)
        }
    }
}
