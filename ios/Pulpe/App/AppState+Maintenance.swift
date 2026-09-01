import Foundation

// MARK: - Maintenance

extension AppState {
    func checkMaintenanceStatus() async {
        do {
            isNetworkUnavailable = false
            isInMaintenance = try await maintenanceChecking()
        } catch {
            // Distinguish network errors from server errors:
            // network unreachable → dedicated screen with retry
            // server error → assume maintenance (fail-closed)
            if (error as? URLError) != nil {
                isNetworkUnavailable = true
                isInMaintenance = false
            } else {
                isInMaintenance = true
            }
        }
    }

    /// Fail-open maintenance probe for the foreground unlock path (PUL-337): any failure
    /// answers `false` and leaves the caller on its usual route. Unlike
    /// `checkMaintenanceStatus()`, it never assumes maintenance on error and never touches
    /// `isNetworkUnavailable` — a transient 500 must not trap a returning user behind the
    /// maintenance screen.
    func isMaintenanceActive() async -> Bool {
        (try? await maintenanceChecking()) ?? false
    }

    func retryNetworkCheck() async {
        await retryStartup()
    }

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }
}
