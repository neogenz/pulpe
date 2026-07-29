import SwiftUI

/// Tour 11 header — current month first, account avatar second.
struct DashboardGreeting: View {
    let monthName: String
    var firstName: String?
    var email: String?
    var avatarUrl: String?
    var onAvatarTap: () -> Void

    var body: some View {
        HStack {
            Color.clear
                .frame(
                    width: DesignTokens.TapTarget.minimum,
                    height: DesignTokens.TapTarget.minimum
                )
                .accessibilityHidden(true)

            Spacer()

            Text(monthName.capitalized)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.homeHeroInk)

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
    VStack(spacing: DesignTokens.Spacing.xxl) {
        DashboardGreeting(
            monthName: "juillet",
            firstName: "Maxime",
            email: "maxime@pulpe.app",
            avatarUrl: nil,
            onAvatarTap: {}
        )
        DashboardGreeting(
            monthName: "juillet",
            firstName: nil,
            email: "sofia@pulpe.app",
            avatarUrl: nil,
            onAvatarTap: {}
        )
        DashboardGreeting(
            monthName: "juillet",
            firstName: nil,
            email: nil,
            avatarUrl: nil,
            onAvatarTap: {}
        )
    }
    .padding()
    .background(Color.homeBackground)
}
