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
    private let storage: PulpeAuthStorage
    private var authStateListenerTask: Task<Void, Never>?

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.storage = PulpeAuthStorage()
        self.supabase = Self.makeSupabaseClient(storage: self.storage)
        Task(name: "AuthService.startListener") { [weak self] in
            await self?.startAuthStateListener()
        }
    }

    private func resetClient() {
        authStateListenerTask?.cancel()
        authStateListenerTask = nil
        supabase = Self.makeSupabaseClient(storage: storage)
        // NOTE: gap between client assignment and listener subscription —
        // `.initialSession` / `.tokenRefreshed` events emitted during this window
        // are missed. Acceptable while the listener is logging-only; revisit if
        // the listener takes corrective action.
        Task(name: "AuthService.restartListener") { [weak self] in
            await self?.startAuthStateListener()
        }
    }

    private static func makeSupabaseClient(storage: PulpeAuthStorage) -> SupabaseClient {
        SupabaseClient(
            supabaseURL: AppConfiguration.supabaseURL,
            supabaseKey: AppConfiguration.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    storage: storage,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    private func startAuthStateListener() {
        authStateListenerTask?.cancel()
        let stream = supabase.auth.authStateChanges
        authStateListenerTask = Task(name: "AuthService.authStateListener") {
            for await (event, _) in stream {
                switch event {
                case .tokenRefreshed:
                    Logger.auth.debug("[AUTH] tokenRefreshed — SDK persisted via PulpeAuthStorage")
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

    // MARK: - OAuth

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

    // MARK: - Password Reset & Recovery

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

    // MARK: - Session Validation

    func validateSession() async throws -> UserInfo? {
        do {
            let session = try await supabase.auth.session
            return Self.userInfo(from: session.user, fallbackEmail: "")
        } catch {
            return nil
        }
    }

    // MARK: - Logout

    func logout(scope: SignOutScope = .local) async {
        do {
            try await supabase.auth.signOut(scope: scope)
        } catch {
            Logger.auth.error("logout: signOut failed - \(error)")
        }

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

        let session: Session
        do {
            session = try await supabase.auth.refreshSession(refreshToken: refreshToken)
        } catch {
            Logger.auth.error("validateBiometricSession: session refresh failed - \(error)")
            throw AuthServiceError.biometricSessionExpired
        }

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

    // MARK: - User Info Extraction

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

// MARK: - Auth Errors

enum AuthServiceError: LocalizedError, Equatable {
    case signupFailed(String)
    case loginFailed(String)
    case biometricSaveFailed
    case biometricSessionExpired
    /// Post-auth resolution determined the user is no longer authenticated
    /// (vault-status returned 401 even after a refresh attempt).
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .signupFailed(let message):
            return "L'inscription n'a pas abouti — \(message)"
        case .loginFailed(let message):
            return "La connexion n'a pas abouti — \(message)"
        case .biometricSaveFailed:
            return "Les identifiants biométriques n'ont pas pu être enregistrés"
        case .biometricSessionExpired:
            return "La session biométrique a expiré — reconnecte-toi"
        case .sessionExpired:
            return "Ta session a expiré — reconnecte-toi"
        }
    }
}

// MARK: - Response Types

struct BiometricSessionResult: Sendable {
    let user: UserInfo
    let clientKeyHex: String?
}

/// Auth provider that created the Supabase user.
/// Used to disambiguate email signup from OAuth during post-auth routing.
enum AuthProvider: String, Codable, Equatable, Sendable {
    case email
    case apple
    case google

    /// Maps a Supabase `app_metadata.provider` value to an `AuthProvider`.
    /// Supabase uses lowercase strings like "email", "apple", "google", but some
    /// deployments may return "apple.com" or "google.com" — accept both.
    static func fromSupabase(_ rawValue: String) -> AuthProvider? {
        switch rawValue.lowercased() {
        case "email": return .email
        case "apple", "apple.com": return .apple
        case "google", "google.com": return .google
        default: return nil
        }
    }
}

struct UserInfo: Codable, Equatable, Sendable {
    let id: String
    let email: String
    var firstName: String?
    let provider: AuthProvider?
    /// Mirrored from Supabase `auth.users.app_metadata.early_adopter` — PostHog feature flag target.
    var isEarlyAdopter: Bool = false

    init(id: String, email: String, firstName: String? = nil,
         provider: AuthProvider? = nil, isEarlyAdopter: Bool = false) {
        self.id = id
        self.email = email
        self.firstName = firstName
        self.provider = provider
        self.isEarlyAdopter = isEarlyAdopter
    }
}

struct DeleteAccountResponse: Codable, Sendable {
    let success: Bool
    let message: String
    let scheduledDeletionAt: String
}

struct PasswordRecoveryContext: Equatable, Sendable {
    let userId: String
    let email: String
    let firstName: String?
    let hasVaultCodeConfigured: Bool
}
