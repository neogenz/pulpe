import SwiftUI

/// Loading state for the dashboard. Its regions deliberately follow the loaded
/// screen so the transition keeps the same visual anchors.
struct CurrentMonthSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(spacing: DesignTokens.Spacing.lg) {
                    contentActionSkeleton
                    uncheckedCardSkeleton
                    activityCardSkeleton
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .shimmering()
        .accessibilityLabel("Préparation de ton tableau de bord")
    }

    private var heroZone: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                Spacer()
                SkeletonCircle(size: DesignTokens.IconSize.listRow)
            }

            CurrentMonthHeroSkeleton()
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xxl)
    }

    private var contentActionSkeleton: some View {
        HStack {
            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            Spacer()
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
    }

    private var uncheckedCardSkeleton: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            HStack(spacing: DesignTokens.Spacing.lg) {
                HStack(spacing: -DesignTokens.Spacing.compactGap) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonCircle(size: DesignTokens.IconSize.badge)
                    }
                }

                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )

                Spacer()

                SkeletonShape(
                    width: DesignTokens.Spacing.xs,
                    height: DesignTokens.Spacing.md,
                    cornerRadius: DesignTokens.CornerRadius.xs
                )
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.vertical, DesignTokens.Spacing.lg)

            Divider()
                .padding(.horizontal, DesignTokens.Spacing.xxl)

            VStack(spacing: DesignTokens.Spacing.md) {
                HStack {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    Spacer()
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                }

                HStack(spacing: DesignTokens.Spacing.lg) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.TapTarget.minimum,
                        cornerRadius: .infinity
                    )
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.top, DesignTokens.Spacing.md)
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
    }

    private var activityCardSkeleton: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.Spacing.md
                    )
                }

                Spacer()

                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.TapTarget.minimum,
                    cornerRadius: .infinity
                )
                SkeletonShape(
                    width: DesignTokens.Spacing.xs,
                    height: DesignTokens.Spacing.md,
                    cornerRadius: DesignTokens.CornerRadius.xs
                )
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.md)

            Divider()
                .padding(.horizontal, DesignTokens.Spacing.xxl)

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(0..<3, id: \.self) { index in
                    activityRowSkeleton
                    if index < 2 {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.bottom, DesignTokens.Spacing.sm)
        }
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
    }

    private var activityRowSkeleton: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Spacing.md
                )
            }
            Spacer()
            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth / 2,
                height: DesignTokens.Skeleton.lineHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}

private struct CurrentMonthHeroSkeleton: View {
    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Spacing.sectionGap
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Spacing.md
                )
            }

            HStack {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                Spacer()
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Skeleton.lineHeight
                )
            }

            chartSkeleton

            HStack {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Skeleton.lineHeight
                )
                Spacer()
                SkeletonShape(
                    width: DesignTokens.Spacing.md,
                    height: DesignTokens.Skeleton.lineHeight
                )
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    private var chartSkeleton: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height

            ZStack {
                Path { path in
                    path.move(to: CGPoint(x: 0, y: height * 2 / 3))
                    path.addLine(to: CGPoint(x: width, y: height * 2 / 3))
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    )
                )

                Path { path in
                    path.move(to: CGPoint(x: 0, y: height / 3))
                    path.addCurve(
                        to: CGPoint(x: width * 2 / 3, y: height / 2),
                        control1: CGPoint(x: width / 3, y: height / 3),
                        control2: CGPoint(x: width / 2, y: height / 2)
                    )
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        lineJoin: .round
                    )
                )

                Path { path in
                    path.move(to: CGPoint(x: width * 2 / 3, y: height / 2))
                    path.addLine(to: CGPoint(x: width, y: height / 3))
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        dash: DesignTokens.Chart.dash
                    )
                )
            }
        }
        .frame(height: DesignTokens.Chart.dashboardHeight)
        .accessibilityHidden(true)
    }
}
