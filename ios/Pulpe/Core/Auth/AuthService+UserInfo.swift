import Supabase

extension AuthService {
    static func userInfo(from user: User, fallbackEmail: String) -> UserInfo {
        let metadata = user.userMetadata

        // Priority: firstName (email signup) > given_name (Google) > name (Apple, first sign-in only)
        var firstName: String?
        if case .string(let name) = metadata["firstName"] {
            firstName = name
        } else if case .string(let name) = metadata["given_name"] {
            firstName = name
        } else if case .string(let name) = metadata["name"] {
            firstName = name
        }

        // OAuth profile photo — Google exposes both `avatar_url` and `picture`; Apple/email none.
        var avatarUrl: String?
        if case .string(let url) = metadata["avatar_url"] {
            avatarUrl = url
        } else if case .string(let url) = metadata["picture"] {
            avatarUrl = url
        }

        let appMetadata = user.appMetadata
        var provider: AuthProvider?
        if case .string(let value) = appMetadata["provider"] {
            provider = AuthProvider.fromSupabase(value)
        }
        var isEarlyAdopter = false
        if case .bool(let flag) = appMetadata[AnalyticsService.earlyAdopterProperty] {
            isEarlyAdopter = flag
        }

        return UserInfo(
            id: user.id.uuidString,
            email: user.email ?? fallbackEmail,
            firstName: firstName,
            provider: provider,
            avatarUrl: avatarUrl,
            isEarlyAdopter: isEarlyAdopter
        )
    }
}
