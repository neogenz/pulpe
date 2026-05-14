import Foundation

/// Tracks whether the bundled binary is still supported by the backend.
///
/// `check()` fetches the published minimum version once and compares it
/// against `CFBundleShortVersionString`. On failure (timeout, offline,
/// malformed response) the store **fails open** — the app boots normally.
/// This is intentional: an outage of the version endpoint must never brick
/// users in the field.
@Observable @MainActor
final class AppVersionStore {
    enum Status: Equatable, Sendable {
        case unknown
        case ok
        case forceUpdate(storeURL: URL?)
    }

    private(set) var status: Status = .unknown

    private let service: AppVersionServiceProtocol
    private let currentVersion: String

    init(
        service: AppVersionServiceProtocol = AppVersionService.shared,
        currentVersion: String = AppConfiguration.appVersion
    ) {
        self.service = service
        self.currentVersion = currentVersion
    }

    func check() async {
        do {
            let response = try await service.fetch()
            let minVersion = response.data.ios.minVersion
            if currentVersion.isSemVerBelow(minVersion) {
                let storeURL = response.data.ios.storeUrl.flatMap(URL.init(string:))
                status = .forceUpdate(storeURL: storeURL)
            } else {
                status = .ok
            }
        } catch {
            status = .ok
        }
    }
}
