import SwiftUI

/// Skeleton placeholder rendered while `BudgetDetailsView` waits for its first payload.
/// Mirrors the loaded layout region by region so the loading→loaded transition keeps the
/// same anchors: page header, the hero card (figure, split bar, legend), the filter rail,
/// then the grouped sections.
struct BudgetDetailsSkeletonView: View {
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                pageHeader
                    .padding(.top, DesignTokens.Spacing.sm)
                heroCard
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.lg)
                filterRailSkeleton
                    .padding(.top, DesignTokens.Spacing.xl)
                ForEach(0..<3, id: \.self) { _ in sectionSkeleton }
                Color.clear.frame(height: DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }

    // MARK: - Header

    /// `PageHeader`: the month over its period.
    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            SkeletonShape(
                width: DesignTokens.Skeleton.mediumTextWidth,
                height: DesignTokens.Spacing.sectionGap
            )
            SkeletonShape(
                width: DesignTokens.Skeleton.longTextWidth,
                height: DesignTokens.Skeleton.bodyHeight
            )
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Hero

    /// Same slots and order as `BudgetDetailHero`. No rollover line: it is conditional once
    /// loaded, so a placeholder would promise a row that rarely arrives.
    private var heroCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.extraLongTextWidth,
                    height: DesignTokens.Skeleton.displayHeight,
                    cornerRadius: DesignTokens.CornerRadius.sm
                )
            }

            // `AvailableSplit`: the bar, then its three-column legend.
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.thickHeight,
                    cornerRadius: DesignTokens.ProgressBar.thickHeight / 2
                )
                HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                            SkeletonShape(
                                width: DesignTokens.Skeleton.compactTextWidth,
                                height: DesignTokens.Skeleton.captionHeight
                            )
                            SkeletonShape(
                                width: DesignTokens.Skeleton.shortTextWidth,
                                height: DesignTokens.Skeleton.lineHeight
                            )
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
    }

    // MARK: - Filter rail

    /// `BudgetTypeFilter`: three chips, the first one wider.
    private var filterRailSkeleton: some View {
        HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
            chipSkeleton(width: DesignTokens.Skeleton.compactTextWidth)
            chipSkeleton(width: DesignTokens.Skeleton.mediumTextWidth)
            chipSkeleton(width: DesignTokens.Skeleton.shortTextWidth)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    /// A `PulpeChip` at `.standard` size: a 36pt capsule.
    private func chipSkeleton(width: CGFloat) -> some View {
        SkeletonShape(
            width: width + DesignTokens.ChipMetrics.Standard.horizontalPadding * 2,
            height: DesignTokens.FrameHeight.chip,
            cornerRadius: .infinity
        )
    }

    // MARK: - Section + rows

    /// One `BudgetMixedSection`: header over a single grouped card of divider-separated rows.
    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.sectionHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(0..<3, id: \.self) { index in
                    if index > 0 {
                        Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                    }
                    rowSkeleton
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeRowCard()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xxl)
    }

    /// Mirrors `BudgetLineMixedRow`: pointing ring, name over metadata, amount opposite.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            SkeletonCircle(size: DesignTokens.Checkbox.size)
                .frame(width: DesignTokens.TapTarget.minimum)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            SkeletonShape(
                width: DesignTokens.Skeleton.shortTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }
}
