import Foundation
import OSLog
import Supabase

/// Authentication service using Supabase Auth directly
/// Mirrors the frontend Angular approach - talks directly to Supabase, not the backend
actor AuthService {
    static let shared = AuthService()

    private let supabase: SupabaseClient
    private let keychain: KeychainManager

    private init(keychain: KeychainManager = .shared) {
        self.keychain = keychain
        self.supabase = SupabaseClient(
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

        return UserInfo(
            id: session.user.id.uuidString,
            email: session.user.email ?? email
        )
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

        return UserInfo(
            id: session.user.id.uuidString,
            email: session.user.email ?? email
        )
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

            return UserInfo(
                id: session.user.id.uuidString,
                email: session.user.email ?? ""
            )
        } catch {
            // Session invalid, clear tokens
            await keychain.clearTokens()
            return nil
        }
    }

    // MARK: - Logout

    func logout() async {
        do {
            try await supabase.auth.signOut()
        } catch {
            Logger.auth.error("logout: signOut failed - \(error)")
        }

        // Clear local tokens
        await keychain.clearTokens()
        await keychain.clearBiometricTokens()
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

    func validateBiometricSession() async throws -> UserInfo? {
        guard await keychain.hasBiometricTokens() else {
            return nil
        }

        let refreshToken = try await keychain.getBiometricRefreshToken()

        guard let refreshToken else {
            return nil
        }

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

        return UserInfo(
            id: session.user.id.uuidString,
            email: session.user.email ?? ""
        )
    }

    func clearBiometricTokens() async {
        await keychain.clearBiometricTokens()
    }

    func hasBiometricTokens() async -> Bool {
        await keychain.hasBiometricTokens()
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

struct UserInfo: Codable, Equatable, Sendable {
    let id: String
    let email: String
}

struct DeleteAccountResponse: Codable, Sendable {
    let success: Bool
    let message: String
    let scheduledDeletionAt: String
}
