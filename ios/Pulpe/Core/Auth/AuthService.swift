import Foundation
import OSLog
import Supabase

/// Authentication service using Supabase Auth directly
/// Mirrors the frontend Angular approach - talks directly to Supabase, not the backend
actor AuthService {
    static let shared = AuthService()
    private static let sessionDecoder = JSONDecoder()

    private let supabase: SupabaseClient
    private let keychain: KeychainManager
    private let storage: any AuthLocalStorage

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.storage = PulpeAuthStorage()
        self.supabase = Self.makeSupabaseClient(storage: self.storage)
    }

    private static func makeSupabaseClient(storage: any AuthLocalStorage) -> SupabaseClient {
        SupabaseClient(
            supabaseURL: AppConfiguration.supabaseURL,
            supabaseKey: AppConfiguration.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    storage: storage,
                    storageKey: PulpeAuthStorage.sessionStorageKey,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    // MARK: - Login

    func login(email: String, password: String) async throws -> UserInfo {
        let session = try await supabase.auth.signIn(email: email, password: password)
        return Self.userInfo(from: session.user, fallbackEmail: email)
    }

    // MARK: - Signup

    func signup(email: String, password: String) async throws -> UserInfo {
        let response = try await supabase.auth.signUp(email: email, password: password)

        guard let session = response.session else {
            throw AuthServiceError.signupFailed("No session returned. Email confirmation may be required.")
        }

        return Self.userInfo(from: session.user, fallbackEmail: email)
    }

    // MARK: - Session Validation

    static func isTerminalSessionFailure(_ error: any Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        if case .sessionMissing = authError { return true }
        return false
    }

    static func isConfirmedTerminalSessionFailure(
        _ error: any Error,
        persistedSessionExists: Bool
    ) -> Bool {
        isTerminalSessionFailure(error) && !persistedSessionExists
    }

    /// The SDK removes its persisted blob on sign-out and on confirmed server-side
    /// revocation (reuse-detection, expired session) BEFORE surfacing `sessionMissing`,
    /// so "sessionMissing + no blob" is a reliable terminal verdict. NEVER write that
    /// blob from the app: the SDK persists every rotation itself, and a second writer
    /// could overwrite a freshly-rotated session with a consumed refresh token.
    private func checkAndHandleConfirmedTerminalSessionFailure(_ error: any Error) -> Bool {
        guard Self.isTerminalSessionFailure(error) else { return false }
        let blob: Data?
        do {
            blob = try storage.retrieve(key: PulpeAuthStorage.sessionStorageKey)
        } catch {
            // Slot unreadable — cannot confirm a logout on a keychain read failure.
            Logger.auth.warning("session slot unreadable - \(error, privacy: .public)")
            return false
        }
        guard let blob else { return true }
        // sessionMissing with a persisted blob: either a benign write race (the SDK
        // re-reads the slot on the next attempt) or an undecodable blob the SDK can
        // never restore. Purge the latter so the app converges to the login screen
        // instead of an endless retry loop against a corrupt slot.
        if (try? Self.sessionDecoder.decode(Session.self, from: blob)) == nil {
            Logger.auth.error("session slot undecodable — purging so logout can be confirmed")
            try? storage.remove(key: PulpeAuthStorage.sessionStorageKey)
            return true
        }
        return false
    }

    /// Whether the SDK-owned session blob exists — true iff a user is signed in
    /// (the SDK removes the blob on sign-out and confirmed revocation).
    func hasPersistedSession() -> Bool {
        ((try? storage.retrieve(key: PulpeAuthStorage.sessionStorageKey)) ?? nil) != nil
    }

    func validateSession() async throws -> UserInfo? {
        do {
            let session = try await supabase.auth.session
            return Self.userInfo(from: session.user, fallbackEmail: "")
        } catch {
            if checkAndHandleConfirmedTerminalSessionFailure(error) {
                Logger.auth.info("validateSession: no active session (logged out)")
                return nil
            }
            Logger.auth.error("validateSession: SDK session unavailable - \(error, privacy: .public)")
            throw error
        }
    }

    // MARK: - Logout

    /// Sign out of Supabase. Surfaces the underlying error so callers can decide how
    /// to react — silent swallow used to hide a real risk window: when `.global` is
    /// requested but the network call fails, the access token stays valid server-side
    /// for up to ~1h. Note: supabase-swift's `Auth.signOut` clears its `PulpeAuthStorage`
    /// slot **before** issuing the HTTP call, so local state is already empty even on
    /// throw — there is nothing to roll back. The legacy `keychain.clearTokens()` runs
    /// only on success; on throw the SDK has already done its local cleanup.
    func logout(scope: SignOutScope = .local) async throws {
        try await supabase.auth.signOut(scope: scope)

        // SDK clears its own storage on signOut; clear legacy slot defensively.
        await keychain.clearTokens()
    }

    // MARK: - Account Deletion

    func deleteAccount() async throws -> DeleteAccountResponse {
        try await APIClient.shared.request(.deleteAccount, method: .delete)
    }

    // MARK: - Token Access (for API Client)

    func getAccessToken() async -> String? {
        do {
            let session = try await supabase.auth.session
            return session.accessToken
        } catch {
            Logger.auth.warning("getAccessToken: SDK session unavailable - \(error.localizedDescription)")
            return nil
        }
    }

    /// Forces Supabase to rotate the refresh token even when the access token has not expired.
    /// Used after an API 401 so retrying cannot reuse the token that the backend rejected.
    func forceRefreshAccessToken() async throws -> String? {
        do {
            let session = try await supabase.auth.refreshSession()
            return session.accessToken
        } catch {
            if checkAndHandleConfirmedTerminalSessionFailure(error) {
                Logger.auth.info("forceRefreshAccessToken: no active session (logged out)")
                return nil
            }
            Logger.auth.warning(
                "forceRefreshAccessToken: refresh unavailable - \(error, privacy: .public)"
            )
            throw error
        }
    }

    // MARK: - Legacy Biometric Token Cleanup

    func clearLegacyBiometricTokens() async {
        await keychain.clearLegacyBiometricTokens()
    }
}

// MARK: - OAuth

extension AuthService {
    func signInWithApple(idToken: String, nonce: String) async throws -> UserInfo {
        try await signInWithIdToken(.init(provider: .apple, idToken: idToken, nonce: nonce))
    }

    func signInWithGoogle(idToken: String, accessToken: String) async throws -> UserInfo {
        let credentials = OpenIDConnectCredentials(
            provider: .google,
            idToken: idToken,
            accessToken: accessToken
        )
        return try await signInWithIdToken(credentials)
    }

    private func signInWithIdToken(_ credentials: OpenIDConnectCredentials) async throws -> UserInfo {
        let session = try await supabase.auth.signInWithIdToken(credentials: credentials)
        return Self.userInfo(from: session.user, fallbackEmail: "")
    }
}

// MARK: - Password Reset & Recovery

extension AuthService {
    /// Send a password reset email with a mobile deep-link callback.
    func requestPasswordReset(
        email: String,
        redirectTo: URL = AppConfiguration.passwordResetRedirectURL
    ) async throws {
        try await supabase.auth.resetPasswordForEmail(email, redirectTo: redirectTo)
    }

    /// Consume reset callback URL and create a recovery session.
    /// Returns context required by the reset-password flow.
    func beginPasswordRecovery(from url: URL) async throws -> PasswordRecoveryContext {
        let session = try await supabase.auth.session(from: url)
        let user = session.user
        let metadata = user.userMetadata

        var firstName: String?
        if case .string(let name) = metadata["firstName"] {
            firstName = name
        }

        let hasVaultCodeConfigured: Bool
        if case .bool(let configured) = metadata["vaultCodeConfigured"] {
            hasVaultCodeConfigured = configured
        } else {
            hasVaultCodeConfigured = false
        }

        return PasswordRecoveryContext(
            userId: user.id.uuidString,
            email: user.email ?? "",
            firstName: firstName,
            hasVaultCodeConfigured: hasVaultCodeConfigured
        )
    }

    /// Re-authenticate with current credentials to verify password knowledge.
    func verifyPassword(email: String, password: String) async throws {
        _ = try await supabase.auth.signIn(email: email, password: password)
    }

    /// Persist a first name to Supabase user_metadata.
    /// Called fire-and-forget after social sign-in provides a name not in the JWT.
    func updateUserFirstName(_ name: String) async throws {
        _ = try await supabase.auth.update(
            user: UserAttributes(data: ["firstName": .string(name)])
        )
    }

    /// Update the current user's password in Supabase auth.
    func updatePassword(_ newPassword: String) async throws {
        _ = try await supabase.auth.update(user: UserAttributes(password: newPassword))
        // SDK persists refreshed session via PulpeAuthStorage automatically.
    }
}

// MARK: - User Info Extraction

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

        // `provider` drives post-auth routing (see `AppState.applyPostAuthDestination`).
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
