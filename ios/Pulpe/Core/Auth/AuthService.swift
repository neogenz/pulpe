import Foundation
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
        await keychain.saveTokens(
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
        await keychain.saveTokens(
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
            await keychain.saveTokens(
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
            // Ignore signout errors
        }

        // Clear local tokens
        await keychain.clearTokens()
        await keychain.clearBiometricTokens()
    }

    // MARK: - Token Access (for API Client)

    func getAccessToken() async -> String? {
        // Try to get fresh token from Supabase
        if let session = try? await supabase.auth.session {
            // Update keychain with latest token
            await keychain.saveTokens(
                accessToken: session.accessToken,
                refreshToken: session.refreshToken
            )
            return session.accessToken
        }

        // Fallback to stored token
        return await keychain.getAccessToken()
    }

    // MARK: - Biometric Session

    func saveBiometricTokens() async throws {
        let session = try await supabase.auth.session

        await keychain.saveBiometricTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )
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

        await keychain.saveTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )

        await keychain.saveBiometricTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )

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

    var errorDescription: String? {
        switch self {
        case .signupFailed(let message):
            return "L'inscription n'a pas abouti — \(message)"
        case .loginFailed(let message):
            return "La connexion n'a pas abouti — \(message)"
        }
    }
}

// MARK: - Response Types

struct UserInfo: Codable, Equatable, Sendable {
    let id: String
    let email: String
}
