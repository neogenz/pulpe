import Foundation
import OSLog

enum PostAuthDestination: Equatable, Sendable {
    case needsPinSetup
    case needsPinEntry(needsRecoveryKeyConsent: Bool)
    case authenticated(needsRecoveryKeyConsent: Bool)
    case unauthenticatedSessionExpired
    case vaultCheckFailed
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
        switch await loadVaultStatusWithRetry() {
        case .sessionExpired:
            return .unauthenticatedSessionExpired
        case .unavailable:
            return .vaultCheckFailed
        case .success(let status):
            return await routeFromVaultStatus(status)
        }
    }

    private func routeFromVaultStatus(_ status: VaultStatusResponse) async -> PostAuthDestination {
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

    private enum VaultLoadResult {
        case success(VaultStatusResponse)
        case sessionExpired
        case unavailable
    }

    private func loadVaultStatusWithRetry() async -> VaultLoadResult {
        do {
            return .success(try await vaultStatusProvider.getVaultStatus())
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                let refreshed = await sessionRefresher.refreshSessionForVaultCheck()
                guard refreshed else { return .sessionExpired }
                do {
                    return .success(try await vaultStatusProvider.getVaultStatus())
                } catch let retryError as APIError {
                    if case .unauthorized = retryError {
                        return .sessionExpired
                    }
                    Logger.auth.error("PostAuthResolver: vault-status retry failed - \(retryError)")
                    return .unavailable
                } catch let retryError {
                    Logger.auth.error("PostAuthResolver: vault-status retry failed - \(retryError)")
                    return .unavailable
                }
            case .networkError:
                Logger.auth.warning("PostAuthResolver: network error on vault-status")
                return .unavailable
            default:
                Logger.auth.error("PostAuthResolver: API error on vault-status - \(error)")
                return .unavailable
            }
        } catch {
            Logger.auth.error("PostAuthResolver: unexpected vault-status error - \(error)")
            return .unavailable
        }
    }
}
