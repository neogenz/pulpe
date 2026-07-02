import Foundation

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
    private(set) var entries: [WhatsNewEntry] = []
    private(set) var isPresented = false

    private let service: WhatsNewServiceProtocol
    private let flagsStore: WhatsNewFlagsStoring

    init(
        service: WhatsNewServiceProtocol = WhatsNewService.shared,
        flagsStore: WhatsNewFlagsStoring = WhatsNewFlagsStore()
    ) {
        self.service = service
        self.flagsStore = flagsStore
    }

    func check(currentVersion: String = AppConfiguration.appVersion) async {
        guard let lastSeenVersion = flagsStore.lastSeenVersion else {
            // First install: no prior version to diff against. Record the current
            // version so a *future* update — not this install — is what surfaces
            // the sheet. Never hit the network here (CA6: first install = silence).
            flagsStore.setLastSeenVersion(currentVersion)
            return
        }

        // Same version, or a downgrade (e.g. a debug build running an older
        // binary): nothing to show. `isSemVerBelow` already rejects the equal
        // case; the explicit equality check keeps the intent obvious.
        guard lastSeenVersion != currentVersion,
              lastSeenVersion.isSemVerBelow(currentVersion) else {
            return
        }

        do {
            let response = try await service.fetch(
                currentVersion: currentVersion,
                lastSeenVersion: lastSeenVersion
            )
            let entries = response.data.entries
            guard !entries.isEmpty else {
                // Upgrade happened but nothing user-facing between the two
                // versions: advance the marker silently so we don't re-query on
                // every launch.
                flagsStore.setLastSeenVersion(currentVersion)
                return
            }
            self.entries = entries
            isPresented = true
            AnalyticsService.shared.capture(.iosWhatsNewShown, properties: ["version": currentVersion])
        } catch {
            // Fail open: leave `lastSeenVersion` untouched so the next launch or
            // foreground retries, and never surface anything to the user.
        }
    }

    func dismiss(currentVersion: String = AppConfiguration.appVersion) {
        flagsStore.setLastSeenVersion(currentVersion)
        isPresented = false
    }
}
