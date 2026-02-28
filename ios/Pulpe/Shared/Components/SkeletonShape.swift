import SwiftUI

// MARK: - Skeleton Building Blocks

/// Configurable rounded rectangle placeholder for skeleton loading states
struct SkeletonShape: View {
    var width: CGFloat?
    var height: CGFloat = 16
    var cornerRadius: CGFloat = DesignTokens.CornerRadius.sm

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.skeletonPlaceholder)
            .frame(width: width, height: height)
            .accessibilityHidden(true)
    }
}

/// Circle placeholder for avatar/icon skeletons
struct SkeletonCircle: View {
    var size: CGFloat = 40

    var body: some View {
        Circle()
            .fill(Color.skeletonPlaceholder)
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
