import SwiftUI

/// « D'où viennent ces … ? » (spec.md §4.4): the likely causes of my accounts holding more than Pulpe,
/// each with a small picture and the action the comparison step already has. The sheet only answers:
/// `onChoose` gets the choice once it is closed, and the step does what that answer does there.
struct ReconcileReasonsSheet: View {
    enum Reason: CaseIterable {
        case card, partlySpent, income, savings
    }

    enum Choice {
        case addOwe, noteIncome, reviewAccounts, leave
    }

    /// A checked expense prévision with money still on it.
    struct PartlySpent {
        let name: String
        let amount: Decimal
        let spent: Decimal
        let left: Decimal
    }

    /// Above 0: my accounts hold more than Pulpe.
    let gap: Decimal
    let currency: SupportedCurrency
    let hasOwedRow: Bool
    let partlySpent: PartlySpent?
    /// « Disponible : avant → après » once the gap is noted as an income.
    let note: AccountReconciliation.AvailableNote
    let onChoose: (Choice) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Accessibility sizes: what sits side by side goes one under the other, never cut letter by letter.
    private var isStacked: Bool { dynamicTypeSize.isAccessibilitySize }

    /// Fixed order, each kept only when it can be the cause, three at most.
    static func reasons(hasOwedRow: Bool, hasPartlySpent: Bool) -> [Reason] {
        Array(Reason.allCases.filter {
            switch $0 {
            case .card: !hasOwedRow
            case .partlySpent: hasPartlySpent
            case .income, .savings: true
            }
        }.prefix(3))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text(verbatim: amountsHidden
                        ? AppLocale.string("D'où vient cet argent ?")
                        : AppLocale.string("D'où viennent ces \(gap.asInlineCurrency(currency)) ?"))
                        .font(PulpeTypography.stepTitle)
                        .monospacedDigit()
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    ForEach(Self.reasons(hasOwedRow: hasOwedRow, hasPartlySpent: partlySpent != nil), id: \.self) {
                        card($0)
                    }
                    Button(AppLocale.string("Laisser comme ça")) { choose(.leave) }
                        .tertiaryButtonStyle()
                        .accessibilityIdentifier("reconcileReasonsLeave")
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.sheetBackground)
            // The sheet's name carries no amount; the title under it says how much.
            .navigationTitle(AppLocale.string("Autres raisons"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { SheetCloseButton() } }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    private func choose(_ choice: Choice) {
        onChoose(choice)
        dismiss()
    }

    // MARK: - One card per reason

    private func card(_ reason: Reason) -> some View {
        FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                switch reason {
                case .card: cardReason
                case .partlySpent: partlySpent.map(partlySpentReason)
                case .income: incomeReason
                case .savings: savingsReason
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .accessibilityIdentifier("reconcileReason")
    }

    @ViewBuilder private var cardReason: some View {
        question("Tu as payé par carte de crédit, PayPal ou Klarna ?")
        sideBySide(alignment: .top, spacing: DesignTokens.Spacing.sm) {
            picture {
                caption(Text(verbatim: "Pulpe"))
                sideBySide {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        checkedMark
                        Text("Habits")
                    }
                    .frame(maxWidth: isStacked ? nil : .infinity, alignment: .leading)
                    // A sample, never my money: bare, like the small gap's café.
                    Text(verbatim: Decimal(350).asAmount(for: currency)).monospacedDigit()
                }
            }
            picture {
                caption(Text("Ta banque"))
                caption(Text("Pas encore là"))
            }
        }
        .font(PulpeTypography.captionRegular)
        .foregroundStyle(Color.textPrimary)
        Button(AppLocale.string("Ajouter ce que je dois")) { choose(.addOwe) }
            .secondaryButtonStyle(size: .small)
            .accessibilityIdentifier("reconcileReasonsAddOwed")
    }

    @ViewBuilder
    private func partlySpentReason(_ line: PartlySpent) -> some View {
        let progress = line.amount > 0 ? NSDecimalNumber(decimal: line.spent / line.amount).doubleValue : 0
        question("Une prévision cochée n'est pas toute dépensée ?")
        picture {
            sideBySide {
                HStack(spacing: DesignTokens.Spacing.xs) {
                    checkedMark
                    Text(line.name).lineLimit(isStacked ? nil : 1).sensitiveAmount()
                }
                .frame(maxWidth: isStacked ? nil : .infinity, alignment: .leading)
                Text(verbatim: line.amount.asCurrency(currency)).monospacedDigit().sensitiveAmount()
            }
            .font(PulpeTypography.captionRegular)
            ZStack(alignment: .leading) {
                ProgressBarShape(progress: 1).fill(Color.surface)
                ProgressBarShape(progress: CGFloat(progress)).fill(Color.pulpePrimary)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
            // Spent over planned is an amount too: masked with them, silent to VoiceOver.
            .sensitiveAmount()
            .accessibilityHidden(true)
            sideBySide(spacing: DesignTokens.Spacing.sm) {
                caption(Text(AppLocale.string("\(line.spent.asInlineCurrency(currency)) dépensés")))
                    .frame(maxWidth: isStacked ? nil : .infinity, alignment: .leading)
                caption(Text(AppLocale.string("\(line.left.asInlineCurrency(currency)) encore là")))
            }
            .monospacedDigit()
            .sensitiveAmount()
        }
        // Round, so it never reads as a box to check.
        Label {
            Text("Normal, rien à faire").foregroundStyle(Color.textPrimary)
        } icon: {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.pulpePrimary)
        }
        .font(PulpeTypography.rowTitle)
    }

    @ViewBuilder private var incomeReason: some View {
        let today = Date.now.formatted(.dateTime.day().month(.abbreviated).locale(AppLocale.currentUILocale))
        question("Tu as reçu de l'argent ?")
        samplePicture(
            name: AppLocale.string("Prime · \(today)"), chip: AppLocale.string("Pas dans Pulpe"),
            amount: "+\(gap.asCurrency(currency))", tint: .financialIncome
        )
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Button(amountsHidden
                ? AppLocale.string("Noter un revenu")
                : AppLocale.string("Noter un revenu de \(gap.asInlineCurrency(currency))")) { choose(.noteIncome) }
                .monospacedDigit()
                .secondaryButtonStyle(size: .small)
                .accessibilityIdentifier("reconcileReasonsIncome")
            let before = note.before.asInlineCurrency(currency), after = note.after.asInlineCurrency(currency)
            caption(Text(AppLocale.string("Disponible : \(before) → \(after)")))
                .monospacedDigit()
                .sensitiveAmount()
        }
    }

    @ViewBuilder private var savingsReason: some View {
        question("Ton compte épargne est dans la liste ?")
        samplePicture(
            name: AppLocale.string("Compte épargne"), chip: AppLocale.string("À retirer"),
            amount: gap.asCurrency(currency), tint: .textPrimary
        )
        Button(AppLocale.string("Revoir mes comptes")) { choose(.reviewAccounts) }
            .secondaryButtonStyle(size: .small)
            .accessibilityIdentifier("reconcileReasonsReviewAccounts")
    }

    // MARK: - Pieces

    private func question(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(PulpeTypography.rowTitle)
            .foregroundStyle(Color.textPrimary)
    }

    private func caption(_ text: Text) -> some View {
        text
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
    }

    private var checkedMark: some View {
        Image(systemName: "checkmark.square.fill")
            .foregroundStyle(Color.pulpePrimary)
            .accessibilityHidden(true)
    }

    /// A line as a bank shows it: its name, a chip saying where it stands, its amount.
    private func samplePicture(name: String, chip: String, amount: String, tint: Color) -> some View {
        picture {
            sideBySide(alignment: .top, spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(verbatim: name)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textPrimary)
                    // A read-only fact, small like the goal rows' fact chip; card-colored on the sunk picture.
                    Text(verbatim: chip)
                        .font(PulpeTypography.caption.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(isStacked ? nil : 1)
                        .padding(.horizontal, DesignTokens.Spacing.sm)
                        .padding(.vertical, DesignTokens.Spacing.xxs)
                        .background(Color.surface, in: Capsule())
                }
                .frame(maxWidth: isStacked ? nil : .infinity, alignment: .leading)
                Text(verbatim: amount)
                    .font(PulpeTypography.rowAmount)
                    .monospacedDigit()
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
                    .sensitiveAmount()
            }
        }
    }

    /// Side by side, or one under the other at accessibility sizes.
    private func sideBySide<Content: View>(
        alignment: VerticalAlignment = .center, spacing: CGFloat = DesignTokens.Spacing.xs,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let layout = isStacked
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
            : AnyLayout(HStackLayout(alignment: alignment, spacing: spacing))
        return layout { content() }
    }

    private func picture<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let lines = content()
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) { lines }
            .padding(DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm))
    }
}
