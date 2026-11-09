import SwiftUI

/// « Patrimoine », the fifth tab, shown only behind the `net_worth` flag.
struct NetWorthTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.netWorthPath) {
            NetWorthView()
                .pulpeStatusBarBlur()
                .ignoresForeignKeyboardInset()
        }
    }
}
