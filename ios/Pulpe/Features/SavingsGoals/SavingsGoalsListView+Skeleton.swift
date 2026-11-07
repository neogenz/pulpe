import SwiftUI

/// Loading state for the goals list. Same regions, paddings and card as `goalList`,
/// so nothing shifts when the goals land.
struct SavingsGoalsListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                headerSkeleton
                totalCardSkeleton
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.shortTextWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    VStack(spacing: DesignTokens.Spacing.none) {
                        ForEach(0..<3, id: \.self) { index in
                            if index > 0 { Divider().overlay(Color.outlineVariant) }
                            rowSkeleton
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .pulpeSurfaceCard()
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .shimmering()
        .accessibilityLabel("Préparation de tes objectifs")
        .accessibilityIdentifier("savingsGoalsListSkeletonRoot")
    }

    /// `PageHeader`: title over subtitle, `xl` margin, `sm` above.
    private var headerSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            SkeletonShape(width: DesignTokens.Skeleton.mediumTextWidth, height: DesignTokens.Spacing.sectionGap)
            SkeletonShape(width: DesignTokens.Skeleton.longTextWidth, height: DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.sm)
    }

    /// `SavingsGoalsTotalCard`: eyebrow, the figure, the summary sentence, on a white card.
    private var totalCardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            SkeletonShape(width: DesignTokens.Skeleton.mediumTextWidth, height: DesignTokens.Spacing.md)
            SkeletonShape(width: DesignTokens.Skeleton.longTextWidth, height: DesignTokens.Spacing.sectionGap)
            SkeletonShape(width: DesignTokens.Skeleton.extraLongTextWidth, height: DesignTokens.Spacing.md)
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .padding(.horizontal, DesignTokens.Spacing.lg)
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
