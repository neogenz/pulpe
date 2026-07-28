import SwiftUI

enum GoalGenerationStopContext: Equatable {
    case status(SavingsGoalStatus)
    case deadline(targetDate: String)

    var title: String {
        switch self {
        case .status(.paused): "Objectif en pause"
        case .status: "Objectif atteint"
        case .deadline: "Échéance avancée"
        }
    }

    var removeLabel: String {
        switch self {
        case .status: "Retirer des mois futurs"
        case .deadline: "Supprimer les prévisions"
        }
    }

    var isRemovalDestructive: Bool {
        if case .deadline = self { true } else { false }
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
    let onApply: (SavingsGoalGenerationStopMode) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isApplying = false
    @State private var error: Error?

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

                    if let error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            self.error = nil
                        }
                    }

                    decisionButtons
                }
                .padding(DesignTokens.Spacing.lg)
            }
            .scrollContentBackground(.hidden)
            .pulpeBackground()
            .navigationTitle(context.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Ne rien changer") { dismiss() }
                        .disabled(isApplying)
                }
            }
        }
    }

    private var introduction: String {
        switch context {
        case .status:
            return "\(lines.count) prévision(s) Épargne restent liées à cet objectif sur tes mois futurs. "
                + "Que veux-tu en faire ?"
        case .deadline(let targetDate):
            let label = SavingsGoalDateFormatter.parse(targetDate)?
                .formatted(date: .abbreviated, time: .omitted) ?? targetDate
            return "\(lines.count) prévision(s) dépassent la nouvelle échéance du \(label). "
                + "Que veux-tu en faire ?"
        }
    }

    private var linesList: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(lines) { line in
                HStack {
                    Text("\(Formatters.monthName(for: line.month)) \(String(line.year))")
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    Text(line.amount.asCurrency(currency))
                        .font(PulpeTypography.metricLabelBold)
                        .foregroundStyle(Color.textPrimary)
                        .monospacedDigit()
                        .sensitiveAmount()
                }
            }

            Divider()

            HStack {
                Text("Total")
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(totalAmount.asCompactCurrency(currency))
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
        }
        .pulpeCard()
    }

    private var decisionButtons: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Button {
                Task { await apply(.freeze) }
            } label: {
                Text("Garder sans objectif")
            }
            .primaryButtonStyle(isEnabled: !isApplying)
            .disabled(isApplying)

            Text("Les prévisions restent dans tes budgets, simplement déliées de l'objectif.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)

            Button(role: context.isRemovalDestructive ? .destructive : nil) {
                Task { await apply(.remove) }
            } label: {
                Text(context.removeLabel)
                    .foregroundStyle(context.isRemovalDestructive ? Color.destructivePrimary : Color.textPrimary)
            }
            .secondaryButtonStyle()
            .disabled(isApplying)
            .accessibilityHint("Supprime les prévisions affichées et libère leur montant")

            Text("Les prévisions sont supprimées : le montant redevient disponible chaque mois.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
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
