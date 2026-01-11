import SwiftUI

/// Subtle pulsing indicator shown during sync operations
struct SyncIndicator: View {
    let isSyncing: Bool

    @State private var isPulsing = false

    var body: some View {
        Circle()
            .fill(Color.pulpePrimary)
            .frame(width: 8, height: 8)
            .opacity(isSyncing ? (isPulsing ? 0.4 : 1.0) : 0)
            .scaleEffect(isSyncing ? 1.0 : 0.5)
            .animation(
                isSyncing
                    ? .easeInOut(duration: 0.6).repeatForever(autoreverses: true)
                    : .default,
                value: isPulsing
            )
            .animation(.spring(duration: 0.2), value: isSyncing)
            .onChange(of: isSyncing) { _, syncing in
                isPulsing = syncing
            }
            .accessibilityLabel("Synchronisation en cours")
            .accessibilityHidden(!isSyncing)
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack {
            Text("Syncing")
            Spacer()
            SyncIndicator(isSyncing: true)
        }

        HStack {
            Text("Not syncing")
            Spacer()
            SyncIndicator(isSyncing: false)
        }
    }
    .padding()
}
