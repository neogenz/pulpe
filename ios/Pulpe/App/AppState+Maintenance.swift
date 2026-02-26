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

    func retryNetworkCheck() async {
        await retryStartup()
    }

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }
}
