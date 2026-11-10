import SwiftUI

/// Records one dated snapshot for an asset: its new value, in its own currency.
struct AssetValueSheet: View {
    let asset: Asset

    @Environment(AssetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var amount: Decimal?
    @State private var amountText = ""
    @State private var isNegative = false
    @State private var errorMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case amount
    }

    /// A debt is a remaining balance, never negative; an owned asset goes negative as an overdraft.
    static func snapshotValue(amount: Decimal, isNegative: Bool, direction: AssetDirection) -> Decimal {
        direction == .own && isNegative ? -amount : amount
    }

    private var canSave: Bool { amount != nil && !store.isSaving }

    private var subtitle: String {
        asset.direction == .own
            ? AppLocale.string("\(asset.name) · ce que j'ai aujourd'hui")
            : AppLocale.string("\(asset.name) · ce que je dois aujourd'hui")
    }

    private var lastValue: String {
        let date = asset.latestRecordedAt.formatted(
            .dateTime.day().month(.abbreviated).locale(AppLocale.currentUILocale)
        )
        return AppLocale.string("Dernière valeur : \(asset.latestValue.asCurrency(asset.currency)), le \(date)")
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Mettre à jour la valeur"),
            isLoading: false,
            focus: $focus,
            focusOrder: [.amount]
        ) {
            Text(subtitle)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focus,
                field: .amount,
                hint: AppLocale.string("Nouvelle valeur"),
                currency: asset.currency,
                caption: AppLocale.string("Nouvelle valeur")
            )
            Text(lastValue)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()
            if asset.direction == .own { overdraftToggle }
            if let errorMessage {
                ErrorBanner(message: errorMessage) { self.errorMessage = nil }
            }
            Button {
                Task { await save() }
            } label: {
                Text("Enregistrer")
            }
            .disabled(!canSave)
            .primaryButtonStyle(isEnabled: canSave)
            .accessibilityIdentifier("assetValueSubmit")
        }
    }

    private var overdraftToggle: some View {
        FormCard {
            Toggle(isOn: $isNegative) {
                Text("Solde négatif (découvert)")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
            }
            .tint(Color.pulpePrimary)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
    }

    private func save() async {
        guard canSave, let amount else { return }
        errorMessage = nil
        let value = Self.snapshotValue(amount: amount, isNegative: isNegative, direction: asset.direction)
        do {
            let item = AssetSnapshotItem(assetId: asset.id, value: value)
            try await store.recordSnapshots(AssetSnapshotsCreate(items: [item]))
            dismiss()
        } catch {
            errorMessage = DomainErrorLocalizer.localize(error)
        }
    }
}
