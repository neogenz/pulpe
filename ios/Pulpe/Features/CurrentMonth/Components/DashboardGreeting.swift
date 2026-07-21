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

    /// Initials for the avatar: up to two from the first name's words ("Maxime De" → "MD"),
    /// else the email's first letter (matches `AccountView`), so a logged-in user without a
    /// stored name still gets a letter rather than the anonymous glyph.
    private var initials: String? {
        if let firstName, !firstName.isEmpty {
            let letters = firstName
                .split(separator: " ")
                .prefix(2)
                .compactMap(\.first)
            if !letters.isEmpty { return String(letters).uppercased() }
        }
        if let first = email?.first {
            return String(first).uppercased()
        }
        return nil
    }

    var body: some View {
        HStack {
            Text(greeting)
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            Button(action: onAvatarTap) {
                avatar
            }
            .circleIconButtonStyle()
            .accessibilityLabel("Mon compte")
        }
        .accessibilityElement(children: .contain)
    }

    private var avatar: some View {
        Circle()
            .fill(Color.surfaceContainerLowest)
            .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
            .overlay { avatarContent }
            .clipShape(Circle())
            .shadow(DesignTokens.Shadow.subtle)
    }

    /// Profile photo when the account has one (Google); otherwise initials, otherwise a glyph.
    /// The fallback also shows while the photo loads, so the avatar is never blank.
    @ViewBuilder
    private var avatarContent: some View {
        if let avatarUrl, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image
                        .resizable()
                        .scaledToFill()
                } else {
                    avatarFallback
                }
            }
        } else {
            avatarFallback
        }
    }

    @ViewBuilder
    private var avatarFallback: some View {
        if let initials {
            Text(initials)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textTertiary)
        } else {
            Image(systemName: "person.fill")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textTertiary)
        }
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
