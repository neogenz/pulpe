import Foundation
import OSLog

// MARK: - Response Models

struct VaultStatusResponse: Codable, Sendable {
    let vaultCodeConfigured: Bool
}

struct EncryptionSaltResponse: Codable, Sendable {
    let salt: String
    let kdfIterations: Int
    let hasRecoveryKey: Bool
}

struct RecoveryKeyResponse: Codable, Sendable {
    let recoveryKey: String
}

struct RecoverResponse: Codable, Sendable {
    let success: Bool
}

// MARK: - Request Models

struct ValidateKeyRequest: Codable, Sendable {
    let clientKey: String
}

struct RecoverRequest: Codable, Sendable {
    let recoveryKey: String
    let newClientKey: String
}

// MARK: - EncryptionAPI

actor EncryptionAPI {
    static let shared = EncryptionAPI()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getVaultStatus() async throws -> VaultStatusResponse {
        try await apiClient.request(.encryptionVaultStatus)
    }

    /// Fetch encryption salt and KDF parameters for current user
    func getSalt() async throws -> EncryptionSaltResponse {
        try await apiClient.request(.encryptionSalt)
    }

    /// Validate a derived clientKey against the backend
    func validateKey(_ clientKeyHex: String) async throws {
        let body = ValidateKeyRequest(clientKey: clientKeyHex)
        try await apiClient.requestVoid(.encryptionValidateKey, body: body)
    }

    /// Setup recovery key — create-only, returns 409 if one already exists (requires X-Client-Key header)
    func setupRecoveryKey() async throws -> String {
        let response: RecoveryKeyResponse = try await apiClient.request(.encryptionSetupRecovery)
        return response.recoveryKey
    }

    /// Regenerate recovery key — always replaces the existing one (requires X-Client-Key header)
    func regenerateRecoveryKey() async throws -> String {
        let response: RecoveryKeyResponse = try await apiClient.request(.encryptionRegenerateRecovery)
        return response.recoveryKey
    }

    /// Recover encryption using recovery key and a new clientKey
    func recover(recoveryKey: String, newClientKeyHex: String) async throws {
        let body = RecoverRequest(recoveryKey: recoveryKey, newClientKey: newClientKeyHex)
        try await apiClient.requestVoid(.encryptionRecover, body: body)
    }
}
