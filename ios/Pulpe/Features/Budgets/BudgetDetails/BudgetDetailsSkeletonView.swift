import SwiftUI

/// Skeleton placeholder rendered while `BudgetDetailsView` waits for its first
/// payload. Mirrors the loaded state's `ScrollView` / `LazyVStack` layout so the
/// loading→loaded transition stays visually stable: hero (eyebrow + amount +
/// progress + pills) → filter chips → section header → cards.
struct BudgetDetailsSkeletonView: View {
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                heroSkeleton
                filterBarSkeleton
                sectionSkeleton
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }

    // MARK: - Hero

    private var heroSkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Eyebrow ("DISPONIBLE · €")
            SkeletonShape(width: 120, height: 12, cornerRadius: DesignTokens.CornerRadius.xs)

            // Hero amount — mirrors `PulpeTypography.displayYear` block height
            SkeletonShape(width: 240, height: 56, cornerRadius: DesignTokens.CornerRadius.sm)
                .padding(.top, DesignTokens.Spacing.tightGap)

            // Progress bar + percent
            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.heroHeight,
                    cornerRadius: DesignTokens.CornerRadius.progressBar
                )
                SkeletonShape(width: 36, height: 14, cornerRadius: DesignTokens.CornerRadius.xs)
            }
            .padding(.top, DesignTokens.Spacing.md)

            // Pills row (Revenus · Épargne · Dépenses)
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonShape(width: 120, height: 30, cornerRadius: 15)
                }
            }
            .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Filter bar

    private var filterBarSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            ForEach(0..<4, id: \.self) { _ in
                SkeletonShape(width: 96, height: 36, cornerRadius: 18)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Section + rows

    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header ("Dépenses · 8")
            SkeletonShape(width: 110, height: 18, cornerRadius: DesignTokens.CornerRadius.xs)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(0..<5, id: \.self) { _ in
                rowSkeleton
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }

    /// Mirrors `BudgetLineMixedRow`: PointCircle · (kind tag + name) · amount + suffix · chevron.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.xxs) {
            SkeletonCircle(size: DesignTokens.Checkbox.size)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(width: 60, height: 10)
                SkeletonShape(width: 130, height: 16)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(width: 80, height: 18)
                SkeletonShape(width: 50, height: 10)
            }

            SkeletonShape(width: 6, height: 12, cornerRadius: DesignTokens.CornerRadius.xs)
                .padding(.leading, DesignTokens.Spacing.xs)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .padding(.leading, DesignTokens.Spacing.xs)
        .padding(.trailing, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
    }
}
