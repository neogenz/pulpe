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

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.supabase = SupabaseClient(
            supabaseURL: AppConfiguration.supabaseURL,
            supabaseKey: AppConfiguration.supabaseAnonKey
        )
    }

    private func resetClient() {
        supabase = SupabaseClient(
            supabaseURL: AppConfiguration.supabaseURL,
            supabaseKey: AppConfiguration.supabaseAnonKey
        )
    }

    // MARK: - Login

    func login(email: String, password: String) async throws -> UserInfo {
        let session = try await supabase.auth.signIn(email: email, password: password)

        // Save tokens to keychain for API calls
        try await keychain.saveTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )

        return Self.userInfo(from: session.user, fallbackEmail: email)
    }

    // MARK: - Signup

    func signup(email: String, password: String) async throws -> UserInfo {
        let response = try await supabase.auth.signUp(email: email, password: password)

        guard let session = response.session else {
            throw AuthServiceError.signupFailed("No session returned. Email confirmation may be required.")
        }

        // Save tokens to keychain for API calls
        try await keychain.saveTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )

        return Self.userInfo(from: session.user, fallbackEmail: email)
    }

    // MARK: - Session Validation

    func validateSession() async throws -> UserInfo? {
        // Check if we have tokens
        guard await keychain.hasTokens() else {
            return nil
        }

        do {
            // Try to get current session from Supabase
            let session = try await supabase.auth.session

            // Refresh tokens in keychain
            try await keychain.saveTokens(
                accessToken: session.accessToken,
                refreshToken: session.refreshToken
            )

            return Self.userInfo(from: session.user, fallbackEmail: "")
        } catch {
            // Session invalid, clear tokens
            await keychain.clearTokens()
            return nil
        }
    }

    // MARK: - Logout

    func logout() async {
        do {
            try await supabase.auth.signOut(scope: .local)
        } catch {
            Logger.auth.error("logout: signOut failed - \(error)")
        }

        await keychain.clearTokens()
    }

    /// Logout without revoking the server-side refresh token.
    /// Replaces the SupabaseClient to stop its auto-refresh timer,
    /// then clears the regular keychain. Biometric tokens stay intact.
    func logoutKeepingBiometricSession() async {
        resetClient()
        await keychain.clearTokens()
    }

    // MARK: - Account Deletion

    func deleteAccount() async throws -> DeleteAccountResponse {
        try await APIClient.shared.request(.deleteAccount, method: .delete)
    }

    // MARK: - Token Access (for API Client)

    func getAccessToken() async -> String? {
        // Try to get fresh token from Supabase
        if let session = try? await supabase.auth.session {
            // Update keychain with latest token
            do {
                try await keychain.saveTokens(
                    accessToken: session.accessToken,
                    refreshToken: session.refreshToken
                )
            } catch {
                Logger.auth.error("getAccessToken: failed to persist tokens - \(error)")
            }
            return session.accessToken
        }

        // Supabase session unavailable — fall back to stored token
        Logger.auth.warning("getAccessToken: Supabase session unavailable, falling back to keychain")
        return await keychain.getAccessToken()
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

    /// Fallback: refresh and save tokens to biometric keychain.
    /// Validates tokens before saving to prevent storing stale/expired tokens.
    func saveBiometricTokensFromKeychain() async -> Bool {
        guard let refreshToken = await keychain.getRefreshToken() else {
            return false
        }
        
        // Validate token is still valid before saving
        do {
            let session = try await supabase.auth.refreshSession(refreshToken: refreshToken)
            return await keychain.saveBiometricTokens(
                accessToken: session.accessToken,
                refreshToken: session.refreshToken
            )
        } catch {
            Logger.auth.error("saveBiometricTokensFromKeychain: token refresh failed - \(error)")
            return false
        }
    }

    func validateBiometricSession() async throws -> BiometricSessionResult? {
        guard await keychain.hasBiometricTokens() else {
            return nil
        }

        // Single Face ID prompt via pre-authenticated LAContext
        let context = LAContext()
        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Se connecter avec Face ID"
            )
        } catch let error as LAError where error.code == .userCancel {
            throw KeychainError.userCanceled
        } catch let error as LAError where error.code == .authenticationFailed {
            throw KeychainError.authFailed
        }

        // Read both biometric keychain items with the pre-authenticated context (no extra prompts)
        let refreshToken = try await keychain.getBiometricRefreshToken(context: context)

        guard let refreshToken else {
            return nil
        }

        let clientKeyHex = try? await keychain.getBiometricClientKey(context: context)

        let session = try await supabase.auth.refreshSession(refreshToken: refreshToken)

        try await keychain.saveTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )

        let biometricSaved = await keychain.saveBiometricTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )
        if !biometricSaved {
            Logger.auth.warning("validateBiometricSession: failed to persist biometric tokens")
        }

        let user = Self.userInfo(from: session.user, fallbackEmail: "")
        return BiometricSessionResult(user: user, clientKeyHex: clientKeyHex)
    }

    // MARK: - User Metadata

    func markVaultCodeConfigured() async throws {
        try await supabase.auth.update(user: UserAttributes(data: ["vaultCodeConfigured": .bool(true)]))
    }

    func clearBiometricTokens() async {
        await keychain.clearBiometricTokens()
    }

    func hasBiometricTokens() async -> Bool {
        await keychain.hasBiometricTokens()
    }

    // MARK: - User Info Extraction

    private static func userInfo(from user: User, fallbackEmail: String) -> UserInfo {
        let metadata = user.userMetadata

        var firstName: String?
        if case .string(let name) = metadata["firstName"] {
            firstName = name
        }

        var vaultConfigured = false
        if case .bool(let configured) = metadata["vaultCodeConfigured"] {
            vaultConfigured = configured
        }

        return UserInfo(
            id: user.id.uuidString,
            email: user.email ?? fallbackEmail,
            firstName: firstName,
            vaultCodeConfigured: vaultConfigured
        )
    }
}

// MARK: - Auth Errors

enum AuthServiceError: LocalizedError {
    case signupFailed(String)
    case loginFailed(String)
    case biometricSaveFailed

    var errorDescription: String? {
        switch self {
        case .signupFailed(let message):
            return "L'inscription n'a pas abouti — \(message)"
        case .loginFailed(let message):
            return "La connexion n'a pas abouti — \(message)"
        case .biometricSaveFailed:
            return "Les identifiants biométriques n'ont pas pu être enregistrés"
        }
    }
}

// MARK: - Response Types

struct BiometricSessionResult: Sendable {
    let user: UserInfo
    let clientKeyHex: String?
}

struct UserInfo: Codable, Equatable, Sendable {
    let id: String
    let email: String
    var firstName: String?
    var vaultCodeConfigured: Bool
}

struct DeleteAccountResponse: Codable, Sendable {
    let success: Bool
    let message: String
    let scheduledDeletionAt: String
}
