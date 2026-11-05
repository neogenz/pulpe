import SwiftUI

/// Loading state for the dashboard. Its regions deliberately follow the loaded screen — title,
/// white hero card, « À faire » card, a few movement rows — so the transition keeps the same
/// visual anchors.
struct CurrentMonthSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: DesignTokens.Skeleton.greetingWidth, height: DesignTokens.Spacing.sectionGap)
                    SkeletonShape(width: DesignTokens.Skeleton.greetingWidth, height: DesignTokens.Spacing.md)
                }
                heroCardSkeleton
                cardSkeleton(rows: 2)
                cardSkeleton(rows: 3)
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .shimmering()
        .accessibilityLabel("Préparation de ton tableau de bord")
        .accessibilityIdentifier("homeSkeletonRoot")
    }

    /// Eyebrow, figure, sentence and the plot, in the white card the loaded hero is.
    private var heroCardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(width: DesignTokens.Skeleton.greetingWidth / 2, height: DesignTokens.Spacing.md)
                SkeletonShape(width: DesignTokens.Skeleton.greetingWidth, height: DesignTokens.Spacing.sectionGap)
            }
            SkeletonShape(height: DesignTokens.Skeleton.lineHeight)
            SkeletonShape(height: DesignTokens.Chart.dashboardHeight, cornerRadius: DesignTokens.CornerRadius.card)
        }
        .padding(DesignTokens.Spacing.xl)
        .pulpeSurfaceCard()
    }

    private func cardSkeleton(rows: Int) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SkeletonShape(width: DesignTokens.Skeleton.greetingWidth, height: DesignTokens.Skeleton.lineHeight)
            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(0..<rows, id: \.self) { index in
                    if index > 0 { Divider() }
                    rowSkeleton
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
    }

    /// Disc, name over metadata, amount opposite: the shape every ledger row has.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            SkeletonCircle(size: DesignTokens.IconSize.badge)
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(width: DesignTokens.Skeleton.greetingWidth, height: DesignTokens.Skeleton.lineHeight)
                SkeletonShape(width: DesignTokens.Skeleton.greetingWidth / 2, height: DesignTokens.Spacing.md)
            }
            Spacer()
            SkeletonShape(width: DesignTokens.Skeleton.greetingWidth / 2, height: DesignTokens.Skeleton.lineHeight)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}
