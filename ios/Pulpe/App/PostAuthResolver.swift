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

    func resolve() async -> PostAuthDestination {
        let loadResult = await loadVaultStatusWithRetry()
        #if DEBUG
        Logger.auth.debug("[AUTH_RESOLVER] vaultLoad=\(String(describing: loadResult), privacy: .public)")
        #endif
        switch loadResult {
        case .sessionExpired:
            return .unauthenticatedSessionExpired
        case .unavailable:
            return .vaultCheckFailed
        case .success(let status):
            return await routeFromVaultStatus(status)
        }
    }

    private func routeFromVaultStatus(_ status: VaultStatusResponse) async -> PostAuthDestination {
        #if DEBUG
        let pin = status.pinCodeConfigured
        let recovery = status.recoveryKeyConfigured
        let vault = status.vaultCodeConfigured
        Logger.auth.debug(
            "[AUTH_RESOLVER] vault: pin=\(pin) recovery=\(recovery) vault=\(vault)"
        )
        #endif
        // New or interrupted setup: no PIN and no recovery key.
        if !status.pinCodeConfigured && !status.recoveryKeyConfigured {
            #if DEBUG
            Logger.auth.debug("[AUTH_RESOLVER] → needsPinSetup (no pin, no recovery)")
            #endif
            return .needsPinSetup
        }

        // Recovery key exists but key_check/PIN flag is missing (legacy edge case):
        // force PIN entry and avoid any cached-key bypass.
        if !status.pinCodeConfigured {
            #if DEBUG
            Logger.auth.debug("[AUTH_RESOLVER] → needsPinEntry (no pin, has recovery)")
            #endif
            return .needsPinEntry(needsRecoveryKeyConsent: false)
        }

        let requiresRecoveryKeyConsent = status.pinCodeConfigured && !status.recoveryKeyConfigured
        if requiresRecoveryKeyConsent {
            #if DEBUG
            Logger.auth.debug("[AUTH_RESOLVER] → needsPinEntry (needs recovery consent)")
            #endif
            // Legacy inconsistent state: require explicit PIN verification before recovery consent.
            return .needsPinEntry(needsRecoveryKeyConsent: true)
        }

        #if DEBUG
        Logger.auth.debug("[AUTH_RESOLVER] checking clientKey presence")
        #endif
        let hasClientKey = await clientKeyResolver.resolveClientKey() != nil
        #if DEBUG
        Logger.auth.debug("[AUTH_RESOLVER] hasClientKey=\(hasClientKey)")
        #endif

        if hasClientKey {
            #if DEBUG
            Logger.auth.debug("[AUTH_RESOLVER] → authenticated (has client key)")
            #endif
            return .authenticated(needsRecoveryKeyConsent: false)
        }

        #if DEBUG
        Logger.auth.debug("[AUTH_RESOLVER] → needsPinEntry (no client key)")
        #endif
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
