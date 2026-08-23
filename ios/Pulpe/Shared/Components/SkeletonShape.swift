import SwiftUI

// MARK: - Skeleton Building Blocks

/// Placeholder fill, overridable per subtree — the hero zone's placeholders sit on the
/// forest surface, where the canvas tint would disappear.
private struct SkeletonTintKey: EnvironmentKey {
    static let defaultValue: Color = .skeletonPlaceholder
}

extension EnvironmentValues {
    var skeletonTint: Color {
        get { self[SkeletonTintKey.self] }
        set { self[SkeletonTintKey.self] = newValue }
    }
}

/// Configurable rounded rectangle placeholder for skeleton loading states
struct SkeletonShape: View {
    var width: CGFloat?
    var height: CGFloat = 16
    var cornerRadius: CGFloat = DesignTokens.CornerRadius.sm
    @Environment(\.skeletonTint) private var tint

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(tint)
            .frame(width: width, height: height)
            .accessibilityHidden(true)
    }
}

/// Circle placeholder for avatar/icon skeletons
struct SkeletonCircle: View {
    var size: CGFloat = 40
    @Environment(\.skeletonTint) private var tint

    var body: some View {
        Circle()
            .fill(tint)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// Common list row skeleton: circle + two text lines
struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            SkeletonCircle(size: DesignTokens.IconSize.listRow)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(width: 120, height: 14)
                SkeletonShape(width: 80, height: 11)
            }

            Spacer()

            SkeletonShape(width: 70, height: 14)
        }
    }
}
