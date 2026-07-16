import SwiftUI

/// Advisory at generation stop (PUL-285 CA8): lists the goal's future linked
/// prévisions and offers to freeze them (keep without goal) or remove them —
/// an explicit decision, never an automatic write. Dismissing changes nothing;
/// the detail card stays as re-entry. Neutral savings tones only (RG-002).
struct GoalGenerationStopSheet: View {
    let lines: [SavingsGoalFutureLine]
    let status: SavingsGoalStatus
    let currency: SupportedCurrency
    let onApply: (SavingsGoalGenerationStopMode) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isApplying = false
    @State private var error: Error?

    private var totalAmount: Decimal {
        lines.reduce(0) { $0 + $1.amount }
    }

    private var title: String {
        status == .paused ? "Objectif en pause" : "Objectif atteint"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text("\(lines.count) prévision(s) Épargne restent liées à cet objectif sur tes mois futurs. Que veux-tu en faire ?")
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
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Ne rien changer") { dismiss() }
                        .disabled(isApplying)
                }
            }
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

            Button {
                Task { await apply(.remove) }
            } label: {
                Text("Retirer des mois futurs")
            }
            .secondaryButtonStyle()
            .disabled(isApplying)

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
