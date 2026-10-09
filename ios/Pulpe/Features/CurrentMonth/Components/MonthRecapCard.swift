import SwiftUI

/// Owns when the closed month's recap shows (PUL-111): finds the month before the loaded
/// one in the sparse list the home screen already loads, hides it once dismissed for that
/// month, and presents the detail. Renders nothing otherwise, so the stack it sits in
/// spends no spacing on it.
struct MonthRecapSection: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(BudgetListStore.self) private var budgetListStore

    /// What the sheet was closed with, applied once it is gone: hiding the card while
    /// its sheet is still up would take the sheet's presenter away mid-animation.
    private enum SheetOutcome {
        case acknowledged(MonthRecap)
        case showDetails(budgetId: String)
    }

    private let flags: MonthRecapFlagsStore
    @State private var dismissedKey: String?
    @State private var presentedRecap: MonthRecap?
    @State private var sheetOutcome: SheetOutcome?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init() {
        let flags = MonthRecapFlagsStore()
        self.flags = flags
        _dismissedKey = State(initialValue: flags.lastSeenMonthRecap)
    }

    private var visibleRecap: MonthRecap? {
        guard let budget = store.budget,
              let recap = MonthRecap(closingBefore: budget, among: budgetListStore.budgets, metrics: store.metrics),
              recap.key != dismissedKey
        else { return nil }
        return recap
    }

    var body: some View {
        if let visibleRecap {
            MonthRecapCard(
                recap: visibleRecap,
                onOpen: { presentedRecap = visibleRecap },
                onDismiss: { dismiss(visibleRecap) }
            )
            .transition(.opacity)
            .sheet(item: $presentedRecap, onDismiss: settleSheet) { recap in
                MonthRecapSheet(
                    recap: recap,
                    onShowDetails: { sheetOutcome = .showDetails(budgetId: recap.budgetId) },
                    onAcknowledge: { sheetOutcome = .acknowledged(recap) }
                )
            }
        }
    }

    private func settleSheet() {
        defer { sheetOutcome = nil }
        switch sheetOutcome {
        case .acknowledged(let recap):
            dismiss(recap)
        case .showDetails(let budgetId):
            appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
        case nil:
            break
        }
    }

    private func dismiss(_ recap: MonthRecap) {
        flags.setLastSeenMonthRecap(recap.key)
        if reduceMotion {
            dismissedKey = recap.key
        } else {
            withAnimation(DesignTokens.Animation.smoothEaseOut) {
                dismissedKey = recap.key
            }
        }
    }
}

/// Names the closed month and its result, and offers the detail. Sits at the head of the
/// content zone: the forest above is the hero's alone (ios/DESIGN.md, Two-Zone Rule), and
/// reading the recap is the user's call, so it blocks nothing.
struct MonthRecapCard: View {
    let recap: MonthRecap
    let onOpen: () -> Void
    let onDismiss: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// The month leads the sentence rather than following a preposition: French elides
    /// "de" before avril and octobre, and a catalog entry cannot know that.
    private var monthName: String {
        Formatters.monthName(for: recap.month)
    }

    private var message: String {
        let currency = userSettingsStore.currency
        switch recap.outcome {
        case .saved:
            let amount = recap.endingBalance.asAdaptiveCurrency(currency)
            return AppLocale.string("Bien joué, tu as mis \(amount) de côté.")
        case .overspent:
            let amount = (-recap.endingBalance).asAdaptiveCurrency(currency)
            return AppLocale.string("Ça arrive : \(amount) de plus que prévu.")
        case .balanced:
            return AppLocale.string("Budget respecté.")
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
            RowIcon(systemName: "calendar.badge.checkmark", tint: .pulpePrimary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("\(monthName) est terminé")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)

                Text(message)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()

                Button("Voir le bilan", action: onOpen)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    // 44pt hit area without growing the card (swiftui-hit-areas.md).
                    .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                    .contentShape(Rectangle())
                    .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
                    .textLinkButtonStyle()
                    .padding(.top, DesignTokens.Spacing.xs)
                    .accessibilityIdentifier("monthRecapOpenButton")
            }

            Spacer(minLength: 0)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textTertiary)
            }
            .padding(DesignTokens.TapTarget.minimum / 2)
            .contentShape(Rectangle())
            .padding(-DesignTokens.TapTarget.minimum / 2)
            .plainPressedButtonStyle()
            .accessibilityLabel("Masquer le bilan")
            .accessibilityIdentifier("monthRecapDismissButton")
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeRowCard()
    }
}

#Preview {
    MonthRecapCard(
        recap: MonthRecap(
            budgetId: "preview",
            month: 9,
            year: 2026,
            openedMonth: 10,
            income: 5_000,
            expenses: 4_700,
            endingBalance: 300,
            carriedOver: 300,
            startingAvailable: 5_300
        ),
        onOpen: {},
        onDismiss: {}
    )
    .padding(DesignTokens.Spacing.xxl)
    .environment(UserSettingsStore())
}
