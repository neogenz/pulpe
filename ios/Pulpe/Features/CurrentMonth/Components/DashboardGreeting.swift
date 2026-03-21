import SwiftUI

/// Greeting + motivational headline displayed above the hero card.
/// Adapts tone and color to the current budget emotion state.
struct DashboardGreeting: View {
    let emotionState: BudgetFormulas.EmotionState
    var firstName: String?

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let timeGreeting: String
        switch hour {
        case 5..<12: timeGreeting = "Bonjour"
        case 12..<18: timeGreeting = "Bon après-midi"
        case 18..<22: timeGreeting = "Bonsoir"
        default: timeGreeting = "Bonsoir"
        }
        if let name = firstName, !name.isEmpty {
            return "\(timeGreeting) \(name)"
        }
        return timeGreeting
    }

    private var headline: String {
        switch emotionState {
        case .comfortable: "Tu gères bien ce mois-ci"
        case .tight: "Serré — mais tu le sais"
        case .deficit: "Ça arrive — on gère"
        }
    }

    private var greetingColor: Color {
        switch emotionState {
        case .comfortable: .pulpePrimary
        case .tight: .financialExpense
        case .deficit: .destructivePrimary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(greeting)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(greetingColor)

            Text(headline)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Preview

#Preview("Dashboard Greeting — 3 States") {
    VStack(spacing: 32) {
        DashboardGreeting(emotionState: .comfortable)
        DashboardGreeting(emotionState: .tight)
        DashboardGreeting(emotionState: .deficit)
    }
    .padding()
    .pulpeBackground()
}
