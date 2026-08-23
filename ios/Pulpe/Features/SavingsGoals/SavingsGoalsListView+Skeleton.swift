import SwiftUI

/// Loading state for the goals list. Same regions, paddings and card as `goalList`,
/// so nothing shifts when the goals land.
struct SavingsGoalsListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )

                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(0..<3, id: \.self) { index in
                        if index > 0 {
                            Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                        }
                        rowSkeleton
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeCard()
            }
            .padding(DesignTokens.Spacing.lg)
        }
        .shimmering()
        .accessibilityLabel("Préparation de tes objectifs")
        .accessibilityIdentifier("savingsGoalsListSkeletonRoot")
    }

    /// `SavingsGoalRow`: nature disc, name over the period, the target amount opposite.
    private var rowSkeleton: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
            SkeletonCircle(size: DesignTokens.IconSize.badge)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.bodyHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            SkeletonShape(
                width: DesignTokens.Skeleton.compactTextWidth,
                height: DesignTokens.Skeleton.bodyHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }
}

#Preview {
    NavigationStack {
        SavingsGoalsListSkeletonView()
            .pulpeBackground()
    }
}
