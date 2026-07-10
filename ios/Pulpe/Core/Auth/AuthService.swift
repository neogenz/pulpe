import Foundation
import LocalAuthentication
import OSLog
import Supabase

/// Authentication service using Supabase Auth directly
/// Mirrors the frontend Angular approach - talks directly to Supabase, not the backend
actor AuthService {
    static let shared = AuthService()

    private var supabase: SupabaseClient
    private let keychain: KeychainManager
    private let storage: any AuthLocalStorage
    private var authStateListenerTask: Task<Void, Never>?
    private var pendingBiometricResync = false

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.storage = PulpeAuthStorage()
        self.supabase = Self.makeSupabaseClient(storage: self.storage)
        Task(name: "AuthService.startListener") { [weak self] in
            await self?.startAuthStateListener()
        }
    }
    #if DEBUG
    init(testingSupabase: SupabaseClient, storage: any AuthLocalStorage, pendingBiometricResync: Bool) {
        self.keychain = .shared
        self.storage = storage
        self.supabase = testingSupabase
        self.pendingBiometricResync = pendingBiometricResync
    }
    var isBiometricResyncPendingForTesting: Bool { pendingBiometricResync }
    #endif

    private func resetClient() {
        authStateListenerTask?.cancel()
        authStateListenerTask = nil
        supabase = Self.makeSupabaseClient(storage: storage)
        startAuthStateListener()
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

    private func startAuthStateListener() {
        authStateListenerTask?.cancel()
        let stream = supabase.auth.authStateChanges
        authStateListenerTask = Task(name: "AuthService.authStateListener") { [weak self] in
            for await (event, session) in stream {
                switch event {
                case .initialSession, .tokenRefreshed:
                    Logger.auth.debug("[AUTH] session synchronized via PulpeAuthStorage")
                    await self?.refreshBiometricSnapshotIfPresent(session)
                case .signedOut:
                    Logger.auth.debug("[AUTH] signedOut — SDK cleared storage")
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
    private func isConfirmedTerminalSessionFailure(_ error: any Error) -> Bool {
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
        if (try? JSONDecoder().decode(Session.self, from: blob)) == nil {
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
            if isConfirmedTerminalSessionFailure(error) {
                Logger.auth.info("validateSession: no active session (logged out)")
                return nil
            }
            Logger.auth.error("validateSession: SDK session unavailable - \(error, privacy: .public)")
            throw error
        }
    }

    func validateSessionStrict() async throws -> UserInfo? {
        do {
            let session = try await supabase.auth.session
            return Self.userInfo(from: session.user, fallbackEmail: "")
        } catch {
            if isConfirmedTerminalSessionFailure(error) {
                Logger.auth.info("validateSessionStrict: no active session (logged out)")
                return nil
            }
            Logger.auth.warning(
                "validateSessionStrict: auth session unavailable - \(error, privacy: .public)"
            )
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

    /// Logout without revoking the server-side refresh token.
    /// Order matters: clear the SDK-owned storage slot BEFORE replacing the
    /// SupabaseClient. The new client's `emitInitialSession` reads from
    /// PulpeAuthStorage on subscribe and may trigger a silent refresh that
    /// writes the slot back — see AuthClient.swift `emitInitialSession`.
    /// Biometric tokens stay intact as cold-storage for re-entry.
    func logoutKeepingBiometricSession() async {
        do {
            try storage.remove(key: PulpeAuthStorage.sessionStorageKey)
        } catch {
            Logger.auth.warning("logoutKeepingBiometricSession: storage.remove failed - \(error)")
        }
        resetClient()
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
            if isConfirmedTerminalSessionFailure(error) {
                Logger.auth.info("forceRefreshAccessToken: no active session (logged out)")
                return nil
            }
            Logger.auth.warning(
                "forceRefreshAccessToken: refresh unavailable - \(error, privacy: .public)"
            )
            throw error
        }
    }

    // MARK: - Biometric Session

    func saveBiometricTokens() async throws {
        let session = try await supabase.auth.session

        let saved = await keychain.saveBiometricTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )
        if !saved {
            throw AuthServiceError.biometricSaveFailed
        }
    }

    /// Keeps an existing biometric snapshot aligned with Supabase refresh-token rotation.
    /// The atomic keychain update cannot recreate a snapshot cleared concurrently.
    private func refreshBiometricSnapshotIfPresent(_ session: Session?) async {
        guard let session else { return }
        guard !Task.isCancelled else { return }
        let outcome = await keychain.resyncBiometricTokensIfPresent(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )
        switch outcome {
        case .failed:
            // The biometric slot is WhenUnlocked-protected: a rotation that lands while
            // the device is locked (background widget refresh) cannot be snapshotted.
            // Defer instead of dropping — the next foreground replays it (device unlocked).
            pendingBiometricResync = true
            Logger.auth.warning("[AUTH] biometric snapshot resync failed after token refresh — deferred")
        case .resnapshotted, .noSlot:
            pendingBiometricResync = false
        }
    }

    /// Replays a biometric snapshot resync that failed while the device was locked.
    /// Call on foreground entry — the device is unlocked, so the write can succeed.
    func retryPendingBiometricResync() async {
        guard pendingBiometricResync, !Task.isCancelled else { return }
        do {
            let session = try await supabase.auth.session
            // The auth-state listener can complete the deferred resync while this
            // session lookup is suspended; do not write a stale duplicate snapshot.
            guard pendingBiometricResync, !Task.isCancelled else { return }
            await refreshBiometricSnapshotIfPresent(session)
        } catch {
            // Keep retrying after transport and transient SDK failures. A confirmed
            // terminal logout is the only case where pending work cannot succeed.
            if isConfirmedTerminalSessionFailure(error) {
                pendingBiometricResync = false
            }
        }
    }

    func validateBiometricSession() async throws -> BiometricSessionResult? {
        let hasBiometricTokens = await keychain.hasBiometricTokens()
        #if DEBUG
        Logger.auth.debug("[AUTH_BIO_KEYCHAIN_TOKENS] present=\(hasBiometricTokens, privacy: .public)")
        #endif
        guard hasBiometricTokens else {
            return nil
        }

        // Single biometric prompt via pre-authenticated LAContext
        // SAFETY: LAContext is not Sendable but nonisolated(unsafe) is correct here because:
        // 1. The context is created, evaluated, and consumed entirely within this function scope.
        // 2. It is never shared with another task or stored beyond this call.
        // 3. All subsequent uses (getBiometricRefreshToken, getBiometricClientKey) are sequential awaits.
        nonisolated(unsafe) let context = LAContext()
        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Se connecter avec \(BiometricService.shared.biometryDisplayName)"
            )
        } catch let error as LAError where error.code == .userCancel {
            throw KeychainError.userCanceled
        } catch is LAError {
            throw KeychainError.authFailed
        }

        // Read both biometric keychain items with the pre-authenticated context (no extra prompts)
        let refreshToken = try await keychain.getBiometricRefreshToken(context: context)

        guard let refreshToken else {
            #if DEBUG
            Logger.auth.debug("[AUTH_BIO_KEYCHAIN_REFRESH] missing")
            #endif
            return nil
        }

        let clientKeyHex: String?
        do {
            clientKeyHex = try await keychain.getBiometricClientKey(context: context)
        } catch {
            Logger.auth.warning("validateBiometricSession: biometric client key retrieval failed - \(error)")
            clientKeyHex = nil
        }
        #if DEBUG
        Logger.auth.debug("[AUTH_BIO_KEYCHAIN_CLIENT_KEY] present=\((clientKeyHex != nil), privacy: .public)")
        #endif

        let session = try await refreshSessionFromBiometricSnapshot(refreshToken)

        // SDK persisted the new session via PulpeAuthStorage. The biometric slot
        // is single-use cold-storage — clear it so the next logout-keep-biometric
        // re-snapshots a fresh refresh token (PUL-132: prevents drift / reuse-detection).
        await keychain.clearBiometricTokens()

        let user = Self.userInfo(from: session.user, fallbackEmail: "")
        return BiometricSessionResult(user: user, clientKeyHex: clientKeyHex)
    }

    func clearBiometricTokens() async {
        await keychain.clearBiometricTokens()
    }

    func hasBiometricTokens() async -> Bool {
        await keychain.hasBiometricTokens()
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

// MARK: - Biometric Refresh Helper

extension AuthService {
    /// Redeems the single-use biometric refresh token against Supabase.
    /// A terminal verdict (SDK already purged the stored session) maps to
    /// `biometricSessionExpired`; anything else is rethrown as retryable.
    private func refreshSessionFromBiometricSnapshot(_ refreshToken: String) async throws -> Session {
        do {
            return try await supabase.auth.refreshSession(refreshToken: refreshToken)
        } catch {
            Logger.auth.error("validateBiometricSession: session refresh failed - \(error, privacy: .public)")
            await MainActor.run {
                AnalyticsService.shared.captureAuthError(
                    .sessionRestoreFailed, error: error, method: "biometric_refresh"
                )
            }
            if Self.isTerminalSessionFailure(error) {
                throw AuthServiceError.biometricSessionExpired
            }
            throw error
        }
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
            isEarlyAdopter: isEarlyAdopter
        )
    }
}
