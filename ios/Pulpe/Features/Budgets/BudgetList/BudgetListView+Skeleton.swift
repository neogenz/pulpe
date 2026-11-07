import SwiftUI

/// Loading state of the yearly view. Zones, paddings and row heights follow `budgetList`
/// so the arriving data lands on the anchors already drawn.
struct BudgetListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    sectionHeaderSkeleton

                    VStack(spacing: DesignTokens.Spacing.none) {
                        ForEach(0..<3, id: \.self) { index in
                            if index > 0 { Divider() }
                            monthRowSkeleton
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .pulpeSurfaceCard()
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .shimmering()
        .background { Color.appBackground.ignoresSafeArea() }
        .accessibilityLabel("Chargement des budgets")
    }

    /// The page title, the year segments and the recap card, as `yearHeader` lays them out.
    private var heroZone: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            pageHeaderSkeleton
            SkeletonShape(height: DesignTokens.TapTarget.minimum, cornerRadius: DesignTokens.CornerRadius.button)
            yearRecapSkeleton
                .padding(DesignTokens.Spacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeSurfaceCard()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.sm)
    }

    /// `PageHeader`: title over subtitle, on the page's own `xl` margin (`yearHeader` pulls it
    /// back by `lg` first).
    private var pageHeaderSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            SkeletonShape(width: DesignTokens.Skeleton.mediumTextWidth, height: DesignTokens.Spacing.sectionGap)
            SkeletonShape(width: DesignTokens.Skeleton.longTextWidth, height: DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl - DesignTokens.Spacing.lg)
    }

    /// `YearRecapCard`: eyebrow over the display figure, then the sentence.
    private var yearRecapSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Spacing.md
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.longTextWidth,
                    height: DesignTokens.Spacing.sectionGap
                )
            }

            SkeletonShape(
                width: DesignTokens.Skeleton.extraLongTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    private var sectionHeaderSkeleton: some View {
        SkeletonShape(
            width: DesignTokens.Skeleton.shortTextWidth,
            height: DesignTokens.Skeleton.lineHeight
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// `BudgetMonthRow`: month over caption, the amount block, the chevron slot.
    private var monthRowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            chevronSlot
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }

    /// Holds the width the chevron will take, so the amounts don't shift when data lands.
    private var chevronSlot: some View {
        SkeletonShape(
            width: DesignTokens.Spacing.xs,
            height: DesignTokens.Spacing.md,
            cornerRadius: DesignTokens.CornerRadius.xs
        )
    }
}
