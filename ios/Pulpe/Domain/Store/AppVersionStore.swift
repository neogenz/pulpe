import Foundation

/// Tracks whether the bundled binary is current and still supported.
///
/// `minVersion` remains the blocking floor. Once that check passes,
/// `latestVersion` may expose one dismissible App Store prompt per target
/// version. On failure the store fails open at cold launch and preserves any
/// later confirmed state.
@Observable @MainActor
final class AppVersionStore {
    struct AvailableUpdate: Identifiable, Equatable, Sendable {
        let version: String
        let storeURL: URL

        var id: String { version }
    }

    enum Status: Equatable, Sendable {
        case unknown
        case ok
        case updateAvailable(AvailableUpdate)
        case forceUpdate(storeURL: URL?)
    }

    private(set) var status: Status = .unknown

    private let service: AppVersionServiceProtocol
    private let flagsStore: AppUpdateFlagsStoring
    private let currentVersion: String

    init(
        service: AppVersionServiceProtocol = AppVersionService.shared,
        flagsStore: AppUpdateFlagsStoring = AppUpdateFlagsStore(),
        currentVersion: String = AppConfiguration.appVersion
    ) {
        self.service = service
        self.flagsStore = flagsStore
        self.currentVersion = currentVersion
    }

    func check() async {
        do {
            let response = try await service.fetch()
            let policy = response.data.ios
            let storeURL = Self.absoluteURL(from: policy.storeUrl)
            if currentVersion.isSemVerBelow(policy.minVersion) {
                status = .forceUpdate(storeURL: storeURL)
            } else if currentVersion.isSemVerBelow(policy.latestVersion),
                      let storeURL {
                let update = AvailableUpdate(
                    version: policy.latestVersion,
                    storeURL: storeURL
                )
                if flagsStore.lastPromptedVersion != policy.latestVersion
                    || isPresentingUpdate(version: policy.latestVersion) {
                    status = .updateAvailable(update)
                } else {
                    status = .ok
                }
            } else {
                status = .ok
            }
        } catch {
            // Fail-open ONLY on first launch (status == .unknown) so a backend
            // outage on cold-launch never bricks users. Once we have a
            // confirmed status — either .ok or .forceUpdate — preserve it:
            // dropping to .ok on a later failure would let an offline device
            // bypass the gate by toggling airplane mode after a forced cover
            // already displayed.
            if status == .unknown {
                status = .ok
            }
        }
    }

    func markUpdatePresented() {
        guard case .updateAvailable(let update) = status else { return }
        flagsStore.setLastPromptedVersion(update.version)
    }

    func dismissUpdateAvailable() {
        guard case .updateAvailable = status else { return }
        status = .ok
    }

    private static func absoluteURL(from value: String?) -> URL? {
        guard let value,
              let url = URL(string: value),
              url.scheme != nil else { return nil }
        return url
    }

    private func isPresentingUpdate(version: String) -> Bool {
        guard case .updateAvailable(let update) = status else { return false }
        return update.version == version
    }
}
