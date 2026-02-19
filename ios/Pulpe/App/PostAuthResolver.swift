import Foundation
import OSLog

enum PostAuthDestination: Equatable, Sendable {
    case needsPinSetup
    case needsPinEntry(needsRecoveryKeyConsent: Bool)
    case authenticated(needsRecoveryKeyConsent: Bool)
    case unauthenticatedSessionExpired
}

protocol PostAuthResolving: Sendable {
    func resolve() async -> PostAuthDestination
}

protocol VaultStatusProviding: Sendable {
    func getVaultStatus() async throws -> VaultStatusResponse
}

protocol SessionRefreshing: Sendable {
    func refreshSessionForVaultCheck() async -> Bool
}

protocol ClientKeyResolving: Sendable {
    func resolveClientKey() async -> String?
}

extension EncryptionAPI: VaultStatusProviding {}
extension ClientKeyManager: ClientKeyResolving {}

extension AuthService: SessionRefreshing {
    func refreshSessionForVaultCheck() async -> Bool {
        do {
            return try await validateSession() != nil
        } catch {
            return false
        }
    }
}

struct PostAuthResolver: PostAuthResolving {
    let vaultStatusProvider: any VaultStatusProviding
    let sessionRefresher: any SessionRefreshing
    let clientKeyResolver: any ClientKeyResolving

    init(
        vaultStatusProvider: any VaultStatusProviding,
        sessionRefresher: any SessionRefreshing,
        clientKeyResolver: any ClientKeyResolving
    ) {
        self.vaultStatusProvider = vaultStatusProvider
        self.sessionRefresher = sessionRefresher
        self.clientKeyResolver = clientKeyResolver
    }

    func resolve() async -> PostAuthDestination {
        guard let status = await loadVaultStatusWithRetry() else {
            return .unauthenticatedSessionExpired
        }

        // New or interrupted setup: no PIN and no recovery key.
        if !status.pinCodeConfigured && !status.recoveryKeyConfigured {
            return .needsPinSetup
        }

        // Recovery key exists but key_check/PIN flag is missing (legacy edge case):
        // force PIN entry and avoid any cached-key bypass.
        if !status.pinCodeConfigured {
            return .needsPinEntry(needsRecoveryKeyConsent: false)
        }

        let requiresRecoveryKeyConsent = status.pinCodeConfigured && !status.recoveryKeyConfigured
        if requiresRecoveryKeyConsent {
            // Legacy inconsistent state: require explicit PIN verification before recovery consent.
            return .needsPinEntry(needsRecoveryKeyConsent: true)
        }

        let hasClientKey = await clientKeyResolver.resolveClientKey() != nil

        if hasClientKey {
            return .authenticated(needsRecoveryKeyConsent: false)
        }

        return .needsPinEntry(needsRecoveryKeyConsent: false)
    }

    private func loadVaultStatusWithRetry() async -> VaultStatusResponse? {
        do {
            return try await vaultStatusProvider.getVaultStatus()
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                let refreshed = await sessionRefresher.refreshSessionForVaultCheck()
                guard refreshed else { return nil }
                do {
                    return try await vaultStatusProvider.getVaultStatus()
                } catch let retryError as APIError {
                    if case .unauthorized = retryError {
                        return nil
                    }
                    Logger.auth.error("PostAuthResolver: vault-status retry failed - \(retryError)")
                    return fallbackVaultStatus()
                } catch let retryError {
                    Logger.auth.error("PostAuthResolver: vault-status retry failed - \(retryError)")
                    return fallbackVaultStatus()
                }
            case .networkError:
                Logger.auth.warning("PostAuthResolver: network error on vault-status, using fallback")
                return fallbackVaultStatus()
            default:
                Logger.auth.error("PostAuthResolver: API error on vault-status - \(error)")
                return fallbackVaultStatus()
            }
        } catch {
            Logger.auth.error("PostAuthResolver: unexpected vault-status error - \(error)")
            return fallbackVaultStatus()
        }
    }

    private func fallbackVaultStatus() -> VaultStatusResponse? {
        nil
    }
}
