import SwiftUI

/// Under a seeded row: what the account was worth when last recorded.
struct LinkedAccountHint: View {
    let asset: Asset

    var body: some View {
        Text(AppLocale.string("Dernier solde : \(asset.latestValue.asCurrency(asset.currency)), \(asset.ageLabel())"))
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .sensitiveAmount()
    }
}

/// Tells which rows are kept in Mon patrimoine, and that the others are not saved.
struct LinkedAccountsFootnote: View {
    var body: some View {
        // swiftlint:disable:next line_length
        Text("Je garde le solde de tes comptes « Dans Pulpe » dans Mon patrimoine. Les autres lignes ne sont pas enregistrées.")
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct RecordsLinkedSnapshots: ViewModifier {
    let flow: ReconcileAccountsFlow
    @Environment(AssetStore.self) private var assetStore
    @Environment(ToastManager.self) private var toastManager

    func body(content: Content) -> some View {
        content.onChange(of: flow.isCompleted) { _, isCompleted in
            let items = flow.linkedSnapshotItems
            guard isCompleted, !items.isEmpty else { return }
            Task {
                do { try await assetStore.recordSnapshots(AssetSnapshotsCreate(items: items)) } catch {
                    toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
                }
            }
        }
    }
}

extension View {
    /// Completion, and only completion, turns the filled seeded rows into dated asset values.
    func recordsLinkedSnapshots(of flow: ReconcileAccountsFlow) -> some View {
        modifier(RecordsLinkedSnapshots(flow: flow))
    }
}
