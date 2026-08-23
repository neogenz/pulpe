import Supabase

extension AuthService {
    static func userInfo(from user: User, fallbackEmail: String) -> UserInfo {
        let metadata = user.userMetadata
        let firstName = FirstNameResolver.canonical(from: metadata)

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
