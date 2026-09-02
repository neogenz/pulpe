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

    /// Asks the server whether it is in maintenance, for the foreground unlock path (PUL-337).
    ///
    /// A network round trip, not a state read, so it is bounded by
    /// `AppConfiguration.maintenanceProbeTimeout` and abandoned when the caller is cancelled.
    /// It fails OPEN: a timeout, an offline radio or any server error answers `false` and the
    /// caller keeps its usual route. That is the opposite of `checkMaintenanceStatus()`, which
    /// assumes maintenance on error — fail-closed here would trap a returning user behind the
    /// maintenance screen on a transient 500.
    func probeMaintenanceFailingOpen() async -> Bool {
        let probe = Task(name: "AppState.maintenanceProbe") { try await maintenanceChecking() }
        let deadline = Task(name: "AppState.maintenanceProbeDeadline") {
            try? await Task.sleep(for: AppConfiguration.maintenanceProbeTimeout)
            probe.cancel()
        }
        defer { deadline.cancel() }
        return await withTaskCancellationHandler {
            (try? await probe.value) ?? false
        } onCancel: {
            probe.cancel()
        }
    }

    func retryNetworkCheck() async {
        await retryStartup()
    }

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }
}
