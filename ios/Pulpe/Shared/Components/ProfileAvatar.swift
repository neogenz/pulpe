import SwiftUI

/// Account avatar shared by the dashboard greeting and the account sheet header:
/// profile photo when the account has one (Google), otherwise initials, otherwise a
/// glyph. The fallback also shows while the photo loads, so the avatar is never blank.
///
/// The caller owns the shadow — the dashboard button carries one, the account header
/// sits flat on the sheet. Defaults reproduce the dashboard avatar; the account header
/// overrides the four visual inputs.
struct ProfileAvatar: View {
    let firstName: String?
    let email: String?
    let avatarUrl: String?
    var diameter: CGFloat = DesignTokens.IconSize.listRow
    var background: Color = .surfaceContainerLowest
    var foreground: Color = .textTertiary
    var font: Font = PulpeTypography.metricLabelBold

    var body: some View {
        Circle()
            .fill(background)
            .frame(width: diameter, height: diameter)
            .overlay { content }
            .clipShape(Circle())
    }

    @ViewBuilder
    private var content: some View {
        if let avatarUrl, let url = URL(string: avatarUrl) {
            CachedAsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                fallback
            }
        } else {
            fallback
        }
    }

    @ViewBuilder
    private var fallback: some View {
        if let initials = Self.initials(firstName: firstName, email: email) {
            Text(initials)
                .font(font)
                .foregroundStyle(foreground)
        } else {
            Image(systemName: "person.fill")
                .font(font)
                .foregroundStyle(foreground)
        }
    }

    /// Up to two letters from the first name's words ("Maxime De" → "MD"), else the
    /// email's first letter, so a logged-in user without a stored name still gets a
    /// letter rather than the anonymous glyph.
    static func initials(firstName: String?, email: String?) -> String? {
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
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.lg) {
        Text("Dashboard").font(.caption).foregroundStyle(.secondary)
        HStack(spacing: DesignTokens.Spacing.lg) {
            ProfileAvatar(
                firstName: "Maxime",
                email: "maxime@pulpe.app",
                avatarUrl: "https://i.pravatar.cc/120"
            )
            ProfileAvatar(firstName: "Maxime De", email: nil, avatarUrl: nil)
            ProfileAvatar(firstName: nil, email: "sofia@pulpe.app", avatarUrl: nil)
            ProfileAvatar(firstName: nil, email: nil, avatarUrl: nil)
        }

        Text("Account header").font(.caption).foregroundStyle(.secondary)
        HStack(spacing: DesignTokens.Spacing.lg) {
            ProfileAvatar(
                firstName: "Maxime",
                email: "maxime@pulpe.app",
                avatarUrl: "https://i.pravatar.cc/120",
                diameter: DesignTokens.IconSize.heroBadge,
                background: .pulpePrimary,
                foreground: .textOnPrimary,
                font: PulpeTypography.amountXL
            )
            ProfileAvatar(
                firstName: nil,
                email: "sofia@pulpe.app",
                avatarUrl: nil,
                diameter: DesignTokens.IconSize.heroBadge,
                background: .pulpePrimary,
                foreground: .textOnPrimary,
                font: PulpeTypography.amountXL
            )
            ProfileAvatar(
                firstName: nil,
                email: nil,
                avatarUrl: nil,
                diameter: DesignTokens.IconSize.heroBadge,
                background: .pulpePrimary,
                foreground: .textOnPrimary,
                font: PulpeTypography.amountXL
            )
        }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
