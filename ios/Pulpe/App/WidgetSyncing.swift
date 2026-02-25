import WidgetKit

// MARK: - Protocol

protocol WidgetSyncing: Sendable {
    func clearAndReload()
}

// MARK: - Production Implementation

struct WidgetSyncAdapter: WidgetSyncing {
    func clearAndReload() {
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()
    }
}
