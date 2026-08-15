import Foundation
import OSLog

/// Drives the one-shot "what's new" sheet shown after an app update.
///
/// `check()` compares the persisted last-seen version against the running binary
/// and, on a genuine upgrade, fetches the release notes published in between. On
/// failure (timeout, offline, malformed response) it **fails open** — nothing is
/// shown and the last-seen marker is left untouched so the next launch retries.
/// This mirrors `AppVersionStore`: a flaky release-notes endpoint must never
/// disrupt a working app.
@Observable @MainActor
final class WhatsNewStore {
    /// Last iOS version shipped before PUL-186 started persisting a seen marker.
    static let migrationBaselineVersion = "1.0.4"

    private(set) var entries: [WhatsNewEntry] = []
    private(set) var isPresented = false
    private(set) var isChecking = false

    private let service: WhatsNewServiceProtocol
    private let flagsStore: WhatsNewFlagsStoring

    init(
        service: WhatsNewServiceProtocol = WhatsNewService.shared,
        flagsStore: WhatsNewFlagsStoring = WhatsNewFlagsStore()
    ) {
        self.service = service
        self.flagsStore = flagsStore
    }

    func check(
        currentVersion: String = AppConfiguration.appVersion,
        locale: SupportedLocale = AppLocale.current
    ) async {
        guard !isChecking, !isPresented else {
            Logger.app.info(
                "[WHATS_NEW] skipped checking=\(self.isChecking) presented=\(self.isPresented)"
            )
            return
        }
        isChecking = true
        defer { isChecking = false }

        let lastSeenVersion: String
        if let persistedVersion = flagsStore.lastSeenVersion {
            lastSeenVersion = persistedVersion
        } else if flagsStore.wasInstalledBeforeWhatsNew {
            // Existing installations predate the PUL-186 key. Start from the
            // last marketing version released before the feature, so the first
            // PUL-186-capable update is not mistaken for a fresh installation.
            lastSeenVersion = Self.migrationBaselineVersion
        } else {
            // Defensive fallback for injected/custom flag stores. Production's
            // `WhatsNewFlagsStore` seeds this marker during app initialization,
            // before authentication can defer `check()` to a later launch.
            flagsStore.setLastSeenVersion(currentVersion)
            Logger.app.info(
                "[WHATS_NEW] first install recorded version=\(currentVersion, privacy: .public)"
            )
            return
        }

        Logger.app.info(
            "[WHATS_NEW] \(lastSeenVersion, privacy: .public) -> \(currentVersion, privacy: .public)"
        )

        // Same version, or a downgrade (e.g. a debug build running an older
        // binary): nothing to show. `isSemVerBelow` already rejects the equal
        // case; the explicit equality check keeps the intent obvious.
        guard lastSeenVersion != currentVersion,
              lastSeenVersion.isSemVerBelow(currentVersion) else {
            Logger.app.info("[WHATS_NEW] skipped version range")
            return
        }

        do {
            let response = try await service.fetch(
                currentVersion: currentVersion,
                lastSeenVersion: lastSeenVersion,
                locale: locale
            )
            let entries = response.data.entries
            guard !entries.isEmpty else {
                // Upgrade happened but nothing user-facing between the two
                // versions: advance the marker silently so we don't re-query on
                // every launch.
                flagsStore.setLastSeenVersion(currentVersion)
                self.entries = []
                Logger.app.info("[WHATS_NEW] no entries")
                return
            }
            self.entries = entries
            isPresented = true
            Logger.app.info("[WHATS_NEW] presenting entries=\(entries.count)")
            AnalyticsService.shared.capture(.iosWhatsNewShown, properties: ["version": currentVersion])
        } catch let error where error.isCancellationOrURLCancellation {
            // Lifecycle cancellation is expected; keep the marker untouched so
            // a later authenticated trigger can retry.
        } catch {
            Logger.app.error("[WHATS_NEW] failed: \(error.localizedDescription, privacy: .public)")
            // Fail open: leave `lastSeenVersion` untouched so the next launch or
            // foreground retries, and never surface anything to the user.
        }
    }

    func dismiss(currentVersion: String = AppConfiguration.appVersion) {
        flagsStore.setLastSeenVersion(currentVersion)
        isPresented = false
        entries = []
    }
}
