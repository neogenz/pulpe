import SwiftUI

enum GoalGenerationStopContext: Equatable {
    case status(SavingsGoalStatus)
    case deadline(targetDate: String)

    var title: String {
        switch self {
        case .status(.paused): AppLocale.string("Objectif en pause")
        case .status: AppLocale.string("Objectif atteint")
        case .deadline: AppLocale.string("Échéance avancée")
        }
    }

    var removeLabel: String {
        switch self {
        case .status: AppLocale.string("Retirer des mois futurs")
        case .deadline: AppLocale.string("Supprimer les prévisions")
        }
    }

    var isRemovalDestructive: Bool {
        if case .deadline = self { true } else { false }
    }

    /// Distinguishes the two entry paths for UI tests, which the localized
    /// `title` can no longer do.
    var rootIdentifier: String {
        switch self {
        case .status: "goalGenerationStopStatusRoot"
        case .deadline: "goalGenerationStopDeadlineRoot"
        }
    }
}

/// Advisory at generation stop (PUL-285 CA8): lists the goal's future linked
/// prévisions and offers to freeze them (keep without goal) or remove them —
/// an explicit decision, never an automatic write. Dismissing changes nothing;
/// the detail card stays as re-entry. Neutral savings tones only (RG-002).
struct GoalGenerationStopSheet: View {
    let lines: [SavingsGoalFutureLine]
    let context: GoalGenerationStopContext
    let currency: SupportedCurrency
    /// Names the goal in the paused intro (« Voyage au Japon est en pause. »).
    var goalName: String?
    /// What the goal already holds; stays put whatever the choice.
    var savedAmount: Decimal?
    let onApply: (SavingsGoalGenerationStopMode) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(BudgetListStore.self) private var budgetListStore: BudgetListStore?
    @State private var isApplying = false
    @State private var error: Error?

    init(
        lines: [SavingsGoalFutureLine],
        context: GoalGenerationStopContext,
        currency: SupportedCurrency,
        goalName: String? = nil,
        savedAmount: Decimal? = nil,
        onApply: @escaping (SavingsGoalGenerationStopMode) async throws -> Void
    ) {
        self.lines = lines
        self.context = context
        self.currency = currency
        self.goalName = goalName
        self.savedAmount = savedAmount
        self.onApply = onApply
    }

    private var totalAmount: Decimal {
        lines.reduce(0) { $0 + $1.amount }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text(introduction)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    linesList

                    removalImpact

                    if let error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            self.error = nil
                        }
                    }
                }
                .padding(DesignTokens.Spacing.lg)
            }
            // On the scroll view itself: placed after the inset, the id would replace the
            // decision buttons' own identifiers.
            .accessibilityIdentifier(context.rootIdentifier)
            .safeAreaInset(edge: .bottom) { decisionButtons }
            .scrollContentBackground(.hidden)
            .pulpeBackground()
            .navigationTitle(context.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { SheetCloseButton() }
            }
        }
    }

    private var introduction: String {
        switch context {
        case .status(.paused) where goalName != nil:
            return AppLocale.string("""
                \(goalName ?? "") est en pause. \(lines.count) prévisions Épargne lui restent liées \
                sur tes mois futurs. Que veux-tu en faire ?
                """)
        case .status:
            return AppLocale.string("""
                \(lines.count) prévision(s) Épargne restent liées à cet objectif sur tes mois futurs. \
                Que veux-tu en faire ?
                """)
        case .deadline(let targetDate):
            let label = SavingsGoalDateFormatter.parse(targetDate)?
                .abbreviatedDateFormatted ?? targetDate
            return AppLocale.string("""
                \(lines.count) prévision(s) dépassent la nouvelle échéance du \(label). \
                Que veux-tu en faire ?
                """)
        }
    }

    private var linesList: some View {
        VStack(spacing: 0) {
            ForEach(Self.groupedLines(lines, currency: currency)) { group in
                row(title: group.title, detail: group.detail, amount: group.total)
                FormRowDivider()
            }
            row(title: AppLocale.string("Total"), detail: nil, amount: totalAmount)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
    }

    private func row(title: String, detail: String?, amount: Decimal) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(title)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                if let detail {
                    Text(detail)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(amount.asAmount(for: currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .accessibilityElement(children: .combine)
    }

    /// « Si tu retires : ton disponible de <1er mois> » A → A + its prévision. Status context
    /// only: a moved deadline keeps the toolbar-free list and its own wording.
    @ViewBuilder
    private var removalImpact: some View {
        if case .status = context, let first = lines.first,
           let before = budgetListStore?.budgets
               .first(where: { $0.month == first.month && $0.year == first.year })?.remaining {
            let month = Formatters.monthNameInText(for: first.month)
            ImpactBlock(
                title: AppLocale.string("Si tu retires : ton disponible de \(month)"),
                impact: MovementImpact(before: before, after: before + first.amount, lineBefore: nil, lineAfter: nil),
                currency: currency,
                tone: .neutral,
                note: savedAmount.map {
                    AppLocale.string("""
                        Si tu gardes sans objectif, il ne change pas. Les \($0.asAmount(for: currency)) \
                        déjà épargnés restent de côté dans les deux cas.
                        """)
                }
            )
        }
    }

    private var decisionButtons: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                Task { await apply(.freeze) }
            } label: {
                Text("Garder sans objectif")
            }
            .primaryButtonStyle(isEnabled: !isApplying)
            .disabled(isApplying)
            .accessibilityIdentifier("goalGenerationStopFreezeButton")

            Group {
                if context.isRemovalDestructive {
                    Button(role: .destructive) { Task { await apply(.remove) } } label: { Text(context.removeLabel) }
                        .destructiveButtonStyle()
                } else {
                    Button { Task { await apply(.remove) } } label: { Text(context.removeLabel) }
                        .secondaryButtonStyle()
                }
            }
            .disabled(isApplying)
            .accessibilityHint("Supprime les prévisions affichées et libère leur montant")
            .accessibilityIdentifier("goalGenerationStopRemoveButton")

            Button("Ne rien changer") { dismiss() }
                .sheetDismissLinkStyle()
                .disabled(isApplying)
                .accessibilityIdentifier("goalGenerationStopCancelButton")
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }

    private func apply(_ mode: SavingsGoalGenerationStopMode) async {
        isApplying = true
        defer { isApplying = false }
        error = nil
        do {
            try await onApply(mode)
            dismiss()
        } catch {
            self.error = error
        }
    }
}

extension GoalGenerationStopSheet {
    struct LineGroup: Equatable, Identifiable {
        let title: String
        let detail: String?
        let total: Decimal

        var id: String { title }
    }

    /// The first month alone, then one row per year: « Janvier à juin 2027 · 6 mois à 500.00 ».
    static func groupedLines(_ lines: [SavingsGoalFutureLine], currency: SupportedCurrency) -> [LineGroup] {
        let sorted = lines.sorted { ($0.year, $0.month) < ($1.year, $1.month) }
        guard let first = sorted.first else { return [] }
        let byYear = Dictionary(grouping: sorted.dropFirst(), by: \.year)
        let rest = byYear.keys.sorted().compactMap { year -> LineGroup? in
            guard let lines = byYear[year], let head = lines.first, let tail = lines.last else { return nil }
            let total = lines.reduce(0) { $0 + $1.amount }
            guard lines.count > 1 else { return single(head) }
            let amounts = Set(lines.map(\.amount))
            let count = lines.count
            let from = Formatters.monthName(for: head.month)
            let to = Formatters.monthNameInText(for: tail.month)
            return LineGroup(
                title: AppLocale.string("\(from) à \(to) \(String(year))"),
                detail: amounts.count == 1
                    ? AppLocale.string("\(count) mois à \(head.amount.asAmount(for: currency))")
                    : AppLocale.string("\(count) mois"),
                total: total
            )
        }
        return [single(first)] + rest
    }

    private static func single(_ line: SavingsGoalFutureLine) -> LineGroup {
        LineGroup(
            title: "\(Formatters.monthName(for: line.month)) \(String(line.year))",
            detail: nil,
            total: line.amount
        )
    }
}
