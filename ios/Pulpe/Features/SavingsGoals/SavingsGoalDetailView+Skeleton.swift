import SwiftUI

/// Loading state for the goal detail. Hero zone then content zone, same paddings as
/// `content(progress:)`, so the surfaces are already painted when the data lands.
struct SavingsGoalDetailSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroSkeleton
                    // Placeholders on the forest: the canvas tint would vanish into it.
                    .environment(\.skeletonTint, Color.heroTile)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.vertical, DesignTokens.Spacing.lg)
                    .heroZone()

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    cardSkeleton
                    cardSkeleton
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.lg)
                .contentZone()
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .accessibilityLabel("Préparation de ton objectif")
        .accessibilityIdentifier("savingsGoalDetailSkeletonRoot")
    }

    /// `GoalProgressHero`: figure over its target line, the layered bar, the tile row,
    /// then the verdict sentences.
    private var heroSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.longTextWidth,
                    height: DesignTokens.Spacing.sectionGap
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.thickHeight,
                    cornerRadius: .infinity
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                tileSkeleton
                tileSkeleton
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(height: DesignTokens.Skeleton.lineHeight)
                SkeletonShape(
                    width: DesignTokens.Skeleton.extraLongTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var tileSkeleton: some View {
        SkeletonShape(
            height: DesignTokens.Skeleton.heroTileHeight,
            cornerRadius: DesignTokens.CornerRadius.card
        )
    }

    /// A section card: leading glyph, title over its message, on the shared card surface.
    private var cardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                SkeletonCircle(size: DesignTokens.IconSize.compact)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.mediumTextWidth,
                        height: DesignTokens.Skeleton.bodyHeight
                    )
                    SkeletonShape(height: DesignTokens.Skeleton.captionHeight)
                    SkeletonShape(
                        width: DesignTokens.Skeleton.longTextWidth,
                        height: DesignTokens.Skeleton.captionHeight
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
    }
}

#Preview {
    NavigationStack {
        SavingsGoalDetailSkeletonView()
            .background { Color.appBackground.ignoresSafeArea() }
    }
}
