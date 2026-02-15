import LocalAuthentication
import SwiftUI

struct NumpadView: View {
    let onDigit: (Int) -> Void
    let onDelete: () -> Void
    var onBiometric: (() -> Void)? = nil
    var onConfirm: (() -> Void)? = nil
    var isDisabled: Bool = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: DesignTokens.Spacing.xxl) {
                    ForEach(row) { item in
                        numpadItem(item)
                    }
                }
            }
        }
    }

    // MARK: - Grid Data

    private var rows: [[NumpadItem]] {
        [
            [.digit(1), .digit(2), .digit(3)],
            [.digit(4), .digit(5), .digit(6)],
            [.digit(7), .digit(8), .digit(9)],
            [bottomLeftItem, .digit(0), .delete],
        ]
    }

    private var bottomLeftItem: NumpadItem {
        if onConfirm != nil { return .confirm }
        if onBiometric != nil { return .biometric }
        return .empty
    }

    // MARK: - Button Rendering

    @ViewBuilder
    private func numpadItem(_ item: NumpadItem) -> some View {
        switch item {
        case .digit(let n):
            NumpadButton(isDisabled: isDisabled) {
                onDigit(n)
            } label: {
                Text("\(n)")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(Color.pinText)
            }
            .accessibilityLabel("\(n)")

        case .biometric:
            NumpadButton(isDisabled: isDisabled) {
                onBiometric?()
            } label: {
                Image(systemName: biometricIconName)
                    .font(.system(size: 24))
                    .foregroundStyle(Color.pinText)
            }
            .accessibilityLabel(BiometricService.shared.biometryDisplayName)

        case .confirm:
            NumpadButton(isDisabled: isDisabled) {
                onConfirm?()
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(Color.pinText)
            }
            .accessibilityLabel("Confirmer")

        case .delete:
            NumpadButton(isDisabled: isDisabled) {
                onDelete()
            } label: {
                Image(systemName: "delete.backward")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.pinText)
            }
            .accessibilityLabel("Supprimer")

        case .empty:
            Color.clear
                .frame(width: 75, height: 75)
        }
    }

    private var biometricIconName: String {
        switch BiometricService.shared.biometryType {
        case .faceID: "faceid"
        case .touchID: "touchid"
        case .opticID: "opticid"
        default: "lock.fill"
        }
    }
}

// MARK: - Numpad Item

private enum NumpadItem: Hashable, Identifiable {
    case digit(Int)
    case biometric
    case confirm
    case delete
    case empty

    var id: String {
        switch self {
        case .digit(let n): "digit-\(n)"
        case .biometric: "biometric"
        case .confirm: "confirm"
        case .delete: "delete"
        case .empty: "empty"
        }
    }
}

// MARK: - Numpad Button

private struct NumpadButton<Label: View>: View {
    let isDisabled: Bool
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    @State private var tapCount = 0

    var body: some View {
        Button {
            tapCount += 1
            action()
        } label: {
            label()
                .frame(width: 75, height: 75)
                .background(Circle().fill(Color.pinButtonFill))
                .overlay(Circle().stroke(Color.pinButtonStroke, lineWidth: 1))
        }
        .buttonStyle(NumpadButtonStyle())
        .sensoryFeedback(.impact(flexibility: .soft), trigger: tapCount)
        .disabled(isDisabled)
    }
}

// MARK: - Button Style

private struct NumpadButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.easeOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

#Preview {
    ZStack {
        Color.pinBackground.ignoresSafeArea()
        NumpadView(
            onDigit: { _ in },
            onDelete: {},
            onBiometric: {}
        )
    }
}
