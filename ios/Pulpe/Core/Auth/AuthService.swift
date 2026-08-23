import Foundation
import OSLog
import Supabase

/// Authentication service using Supabase Auth directly
/// Mirrors the frontend Angular approach - talks directly to Supabase, not the backend
actor AuthService {
    static let shared = AuthService()

    private let supabase: SupabaseClient
    private let keychain: KeychainManager
    private let storage: any AuthLocalStorage
    private var authStateListenerTask: Task<Void, Never>?

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.storage = PulpeAuthStorage()
        self.supabase = Self.makeSupabaseClient(storage: self.storage)
        Task(name: "AuthService.startListener") { [weak self] in
            await self?.startAuthStateListener()
        }
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
                ),
                global: .init(logger: PulpeSupabaseLogger())
            )
        )
    }

    private func startAuthStateListener() {
        authStateListenerTask?.cancel()
        let stream = supabase.auth.authStateChanges
        authStateListenerTask = Task(name: "AuthService.authStateListener") {
            for await (event, session) in stream {
                switch event {
                case .initialSession:
                    Logger.auth.debug("[AUTH] session synchronized via PulpeAuthStorage")
                    AuthSessionDiagnostics.capture(
                        source: "sdk_event",
                        outcome: "initial_session",
                        session: session
                    )
                case .tokenRefreshed:
                    Logger.auth.debug("[AUTH] session synchronized via PulpeAuthStorage")
                    AuthSessionDiagnostics.capture(
                        source: "sdk_event",
                        outcome: "token_refreshed",
                        session: session
                    )
                case .signedOut:
                    Logger.auth.debug("[AUTH] signedOut — SDK cleared storage")
                    AnalyticsService.captureAuthSessionDiagnostic(
                        source: "sdk_event",
                        outcome: "signed_out"
                    )
                default:
                    break
                }
            }
        }
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

    /// The SDK removes its persisted blob on sign-out and on confirmed server-side
    /// revocation (reuse-detection, expired session) BEFORE surfacing `sessionMissing`,
    /// so "sessionMissing + no blob" is a reliable terminal verdict. NEVER write that
    /// blob from the app: the SDK persists every rotation itself, and a second writer
    /// could overwrite a freshly-rotated session with a consumed refresh token.
    private func checkAndHandleConfirmedTerminalSessionFailure(
        _ error: any Error,
        source: String
    ) -> Bool {
        guard Self.isTerminalSessionFailure(error) else { return false }
        let blob: Data?
        do {
            blob = try storage.retrieve(key: PulpeAuthStorage.sessionStorageKey)
        } catch {
            // Slot unreadable — cannot confirm a logout on a keychain read failure.
            Logger.auth.warning("session slot unreadable - \(error, privacy: .public)")
            AnalyticsService.captureAuthSessionDiagnostic(
                source: source,
                outcome: "storage_unreadable"
            )
            return false
        }
        guard let blob else {
            AnalyticsService.captureAuthSessionDiagnostic(
                source: source,
                outcome: "missing_blob"
            )
            return true
        }
        // sessionMissing with a persisted blob: either a benign write race (the SDK
        // re-reads the slot on the next attempt) or an undecodable blob the SDK can
        // never restore. Purge the latter so the app converges to the login screen
        // instead of an endless retry loop against a corrupt slot.
        if !AuthSessionDiagnostics.isDecodableSession(blob) {
            Logger.auth.error("session slot undecodable — purging so logout can be confirmed")
            AnalyticsService.captureAuthSessionDiagnostic(
                source: source,
                outcome: "undecodable_blob"
            )
            try? storage.remove(key: PulpeAuthStorage.sessionStorageKey)
            return true
        }
        AnalyticsService.captureAuthSessionDiagnostic(
            source: source,
            outcome: "valid_blob"
        )
        return false
    }

    /// Whether the SDK-owned session blob exists — true iff a user is signed in
    /// (the SDK removes the blob on sign-out and confirmed revocation).
    func hasPersistedSession() -> Bool {
        ((try? storage.retrieve(key: PulpeAuthStorage.sessionStorageKey)) ?? nil) != nil
    }

    func validateSession() async throws -> UserInfo? {
        AuthSessionDiagnostics.capturePersisted(
            source: "session_validation",
            outcome: "started",
            storage: storage
        )
        do {
            let session = try await supabase.auth.session
            AuthSessionDiagnostics.capture(
                source: "session_validation",
                outcome: "succeeded",
                session: session
            )
            return Self.userInfo(from: session.user, fallbackEmail: "")
        } catch {
            if checkAndHandleConfirmedTerminalSessionFailure(error, source: "session_validation") {
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
    func forceRefreshAccessToken(source: String = "forced_refresh") async throws -> String? {
        AuthSessionDiagnostics.capturePersisted(
            source: source,
            outcome: "started",
            storage: storage
        )
        do {
            let session = try await supabase.auth.refreshSession()
            AuthSessionDiagnostics.capture(source: source, outcome: "succeeded", session: session)
            return session.accessToken
        } catch {
            if checkAndHandleConfirmedTerminalSessionFailure(error, source: source) {
                Logger.auth.info("forceRefreshAccessToken: no active session (logged out)")
                return nil
            }
            AnalyticsService.captureAuthSessionDiagnostic(source: source, outcome: "failed_retryable")
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

        let firstName = FirstNameResolver.canonical(from: metadata)

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

    /// Persist a trimmed first name to Supabase `user_metadata.firstName`.
    /// Throws `AuthServiceError.emptyFirstName` without calling the network when blank.
    @discardableResult
    func updateUserFirstName(_ name: String) async throws -> UserInfo {
        let trimmed = try FirstNameResolver.nameForPersistence(name)
        let user = try await supabase.auth.update(
            user: UserAttributes(data: ["firstName": .string(trimmed)])
        )
        return Self.userInfo(from: user, fallbackEmail: user.email ?? "")
    }

    /// Update the current user's password in Supabase auth.
    func updatePassword(_ newPassword: String) async throws {
        _ = try await supabase.auth.update(user: UserAttributes(password: newPassword))
        // SDK persists refreshed session via PulpeAuthStorage automatically.
    }
}
