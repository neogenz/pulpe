import SwiftUI

/// Progress panel showing expenses vs available budget with a horizontal bar and pace marker.
struct HeroProgressPanel: View {
    let formattedExpenses: String
    let formattedAvailable: String
    let fillPercentage: Double
    let pacePosition: Double
    let timeElapsedPercentage: Double
    let usagePercentage: Double
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                HStack {
                    expensesLabel
                    Spacer()
                    Text("sur \(formattedAvailable) CHF")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(.white.opacity(0.7))
                        .sensitiveAmount()
                }

                progressBar
            }
            .padding(DesignTokens.Spacing.lg)
            .background(
                Color(
                    light: .white.opacity(0.15),
                    dark: .white.opacity(0.20)
                ),
                in: .rect(cornerRadius: DesignTokens.CornerRadius.lg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg)
                    .stroke(.white.opacity(0.15), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voir le d\u{00E9}tail des d\u{00E9}penses")
        .accessibilityValue("\(Int(usagePercentage)) pourcent du budget utilis\u{00E9}")
    }

    private var expensesLabel: some View {
        HStack(spacing: 0) {
            Text("D\u{00E9}pens\u{00E9} ")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(.white)
            Text(formattedExpenses)
                .font(PulpeTypography.labelMedium)
                .bold()
                .foregroundStyle(.white)
                .sensitiveAmount()
            Text(" CHF")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(.white)
        }
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(.black.opacity(0.1))

                Capsule()
                    .fill(.white)
                    .frame(width: geo.size.width * fillPercentage)
                    .overlay(alignment: .trailing) {
                        Circle()
                            .fill(.white.opacity(0.6))
                            .frame(width: 6, height: 6)
                            .shadow(color: .black.opacity(0.1), radius: 2)
                            .padding(.trailing, 4)
                    }
                    .animation(.easeInOut(duration: 1.0), value: fillPercentage)

                if timeElapsedPercentage > 0 {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(.white.opacity(0.7))
                        .frame(width: 3)
                        .shadow(color: .black.opacity(0.4), radius: 2)
                        .position(x: geo.size.width * pacePosition, y: geo.size.height / 2)
                        .animation(.easeInOut(duration: 0.7), value: pacePosition)
                        .accessibilityLabel("Mois \u{00E9}coul\u{00E9} : \(Int(timeElapsedPercentage))%")
                }
            }
        }
        .frame(height: 12)
    }
}
