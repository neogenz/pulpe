import SwiftUI

/// Tour 11 header — hour-based greeting + account avatar (photo → initials → glyph)
/// opening the account sheet.
struct DashboardGreeting: View {
    var firstName: String?
    var email: String?
    var avatarUrl: String?
    var onAvatarTap: () -> Void

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
            return "\(timeGreeting), \(name)"
        }
        return timeGreeting
    }

    var body: some View {
        HStack {
            Text(greeting)
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            Button(action: onAvatarTap) {
                ProfileAvatar(firstName: firstName, email: email, avatarUrl: avatarUrl)
                    .shadow(DesignTokens.Shadow.subtle)
            }
            .circleIconButtonStyle()
            .accessibilityLabel("Mon compte")
        }
        .accessibilityElement(children: .contain)
    }
}

#Preview {
    VStack(spacing: 24) {
        DashboardGreeting(firstName: "Maxime", email: "maxime@pulpe.app", avatarUrl: nil, onAvatarTap: {})
        DashboardGreeting(firstName: nil, email: "sofia@pulpe.app", avatarUrl: nil, onAvatarTap: {})
        DashboardGreeting(firstName: nil, email: nil, avatarUrl: nil, onAvatarTap: {})
    }
    .padding()
    .background(Color.homeBackground)
}
