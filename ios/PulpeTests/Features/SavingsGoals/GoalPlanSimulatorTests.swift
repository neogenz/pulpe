// swiftlint:disable file_length
import Foundation
@testable import Pulpe
import Testing

/// Regression coverage for the zero-valued gap creation (see
/// `frontend/.../goal-plan-simulator-store.spec.ts` for the web mirror of
/// these three scenarios). The wire schema requires a positive amount on
/// `missingMonthAdjustments`, so a redistribution that lands a gap month on
/// exactly 0 must never leak into `apply()`'s payload.
@MainActor
struct GoalPlanSimulatorTests {
    private static let lineId = "line-current"

    private static func simulatorSource(_ fileName: String) throws -> String {
        var url = URL(fileURLWithPath: #filePath)
        url = url.deletingLastPathComponent() // SavingsGoals/
        url = url.deletingLastPathComponent() // Features/
        url = url.deletingLastPathComponent() // PulpeTests/
        url = url.deletingLastPathComponent() // ios/
        return try String(
            contentsOf: url.appendingPathComponent(
                "Pulpe/Features/SavingsGoals/Simulator/\(fileName)"
            ),
            encoding: .utf8
        )
    }

    private func makeGoal() -> SavingsGoal {
        SavingsGoal(
            id: "g1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 500,
            targetDate: "2026-12-31",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func openMonth(
        month: Int = 6,
        amount: Decimal,
        confirmedAmount: Decimal = 0,
        hasBudget: Bool = true
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: .current,
            isLocked: false,
            hasBudget: hasBudget,
            plannedAmount: amount,
            confirmedAmount: confirmedAmount,
            plannedCumulative: amount,
            confirmedCumulative: 0,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: "\(Self.lineId)-\(month)",
                    amount: amount,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    private func gapMonth(hasBudget: Bool = true) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: 7,
            year: 2026,
            state: .gap,
            isLocked: false,
            hasBudget: hasBudget,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )
    }

    private func managedWithdrawalMonth(
        month: Int = 6,
        destination: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination,
        remaining: Decimal = 4_500,
        plannedAmount: Decimal = 1_260,
        isProvisionable: Bool = false,
        hasSavingLine: Bool = true
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: .current,
            isLocked: false,
            isProvisionable: isProvisionable,
            plannedAmount: plannedAmount,
            confirmedAmount: 0,
            plannedWithdrawalAmount: 4_500,
            remainingPlannedWithdrawalAmount: remaining,
            planOnlyWithdrawalAmount: destination == .goalOnly ? remaining : 0,
            planLinkedWithdrawalAmount: destination == .linkedIncome ? remaining : 0,
            planWithdrawalDestination: destination,
            plannedCumulative: plannedAmount,
            confirmedCumulative: 0,
            lines: hasSavingLine ? [
                SavingsGoalPlanLine(
                    budgetLineId: "\(Self.lineId)-\(month)",
                    amount: plannedAmount,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ] : []
        )
    }

    private func makeProgress(
        targetAmount: Decimal,
        initialAmount: Decimal,
        months: [SavingsGoalPlanMonth]
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: targetAmount,
            targetDate: "2026-12-31",
            plannedCumulative: 0,
            confirmed: 0,
            initialAmount: initialAmount,
            achievementPercent: 0,
            monthsElapsed: 0,
            monthsRemaining: 6,
            isOverdue: false,
            pace: 0,
            confirmedPace: 0,
            required: nil,
            projected: nil,
            paceStatus: nil,
            suggestCompletion: nil,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }
}

extension GoalPlanSimulatorTests {
    @Test("linked-income recap explains automatic pointing after realization")
    func recap_explainsAutomaticPointing() throws {
        let source = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")

        #expect(source.contains(
            "Réalise-la dans le budget : le Réel créé sera automatiquement pointé."
        ))
        #expect(source.contains("Planifier le retrait"))
    }

    @Test("uniform recap requires the previous and next amounts to both match")
    func recap_uniformSummaryRequiresMatchingBeforeAndAfter() {
        let first = SavingsPlanCalculator.SimulatedMonth(
            month: openMonth(month: 6, amount: 100),
            simulatedAmount: 300,
            simulatedCumulative: 300,
            isAdjusted: true,
            replacesExistingPlanWithdrawal: false
        )
        let same = SavingsPlanCalculator.SimulatedMonth(
            month: openMonth(month: 7, amount: 100),
            simulatedAmount: 300,
            simulatedCumulative: 600,
            isAdjusted: true,
            replacesExistingPlanWithdrawal: false
        )
        let differentBefore = SavingsPlanCalculator.SimulatedMonth(
            month: openMonth(month: 8, amount: 200),
            simulatedAmount: 300,
            simulatedCumulative: 900,
            isAdjusted: true,
            replacesExistingPlanWithdrawal: false
        )

        #expect(GoalPlanApplyRecapSheet.hasUniformAdjustment([first, same]))
        #expect(!GoalPlanApplyRecapSheet.hasUniformAdjustment([first, differentBefore]))
    }

    @Test("uniform recap presents the previous and next monthly amounts")
    func recap_uniformSummaryPresentsBeforeAndAfter() throws {
        let source = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")

        #expect(source.contains("Text(before.asCompactCurrency(currency))"))
        #expect(source.contains("Text(after.asCompactCurrency(currency))"))
        #expect(source.contains("Text(\"/mois sur \\(changes.count) mois\")"))
        #expect(source.contains("De \\(before.asCurrency(currency)) à \\(after.asCurrency(currency)) "))
        #expect(source.contains("par mois sur \\(changes.count) mois"))
    }

    @Test("simulator states the signed amount legend once, outside editable rows")
    func simulator_showsOneSignedAmountLegend() throws {
        let rowSource = try Self.simulatorSource("GoalPlanSimEditRow.swift")
        let timelineSource = try Self.simulatorSource("GoalPlanSimulatorTimeline.swift")
        let legend = "Un montant négatif retire de l'objectif."

        #expect(!rowSource.contains(legend))
        #expect(timelineSource.components(separatedBy: legend).count == 2)
    }

    @Test("withdrawal destination exposes selection without announcing its symbol")
    func recap_destinationSelectionIsAccessible() throws {
        let source = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")

        #expect(source.contains(".accessibilityHidden(true)"))
        #expect(source.contains(".accessibilityAddTraits(isSelected ? .isSelected : [])"))
        #expect(!source.contains(".accessibilityValue(isSelected"))
        #expect(source.contains(".frame(minHeight: DesignTokens.TapTarget.minimum"))
    }

    @Test("editable amount fields expose a minimum tap target")
    func simulator_editableFieldsExposeMinimumTapTarget() throws {
        let rowSource = try Self.simulatorSource("GoalPlanSimEditRow.swift")
        let sheetSource = try Self.simulatorSource("GoalPlanSimulatorSheet.swift")
        let minimumTarget = ".frame(minHeight: DesignTokens.TapTarget.minimum)"

        #expect(rowSource.contains(minimumTarget))
        #expect(sheetSource.contains(minimumTarget))
        #expect(rowSource.contains("Mouvement de l’objectif, "))
        #expect(rowSource.contains("Formatters.monthName(for: simMonth.month.month)"))
    }

    @Test("simulator controls keep their content at compact widths and large text sizes")
    func simulator_reflowsDenseControlsWithoutTruncating() throws {
        let rowSource = try Self.simulatorSource("GoalPlanSimEditRow.swift")
        let sheetSource = try Self.simulatorSource("GoalPlanSimulatorSheet.swift")
        let recapSource = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")
        let timelineSource = try Self.simulatorSource("GoalPlanSimulatorTimeline.swift")
        let resetButtonStart = try #require(
            timelineSource.range(of: "Button(\"Réinitialiser\")")
        )
        let resetButtonSource = timelineSource[resetButtonStart.lowerBound...].prefix(400)

        // The reset link shares its row with the section title, so it buys its tap
        // target by padding out and back in — a `minHeight` frame would grow the
        // whole header (`swiftui-hit-areas.md`).
        #expect(resetButtonSource.contains(".padding(.vertical, DesignTokens.TapTarget.minimum / 2)"))
        #expect(resetButtonSource.contains(".padding(.vertical, -DesignTokens.TapTarget.minimum / 2)"))
        #expect(rowSource.contains("ViewThatFits(in: .horizontal)"))
        #expect(rowSource.contains("amountEditor(width: 104)"))
        #expect(rowSource.contains("amountEditor(width: nil)"))
        #expect(rowSource.contains(".frame(maxWidth: width == nil ? .infinity : nil)"))
        #expect(!rowSource.contains("amountEditor(width: nil).frame(width: 88)"))
        #expect(sheetSource.contains("globalAmountEditor(width: 96)"))
        #expect(sheetSource.contains("globalAmountEditor(width: nil)"))
        #expect(sheetSource.contains(".frame(maxWidth: width == nil ? .infinity : nil)"))
        #expect(!sheetSource.contains("globalAmountEditor(width: nil).frame(width: 96)"))

        let diffRowStart = try #require(recapSource.range(of: "private func diffRow"))
        let diffRowEnd = try #require(recapSource.range(
            of: "private func withdrawalChange",
            range: diffRowStart.upperBound..<recapSource.endIndex
        ))
        let diffRowSource = recapSource[diffRowStart.lowerBound..<diffRowEnd.lowerBound]
        #expect(diffRowSource.contains("ViewThatFits(in: .horizontal)"))
        #expect(diffRowSource.contains("HStack"))
        #expect(diffRowSource.contains("VStack"))
    }

    @Test("recap names before and after amounts for VoiceOver")
    func recap_namesBeforeAndAfterAmountsForVoiceOver() throws {
        let source = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")

        #expect(source.contains("\\(label), de \\(signedCurrency(from)) à \\(signedCurrency(to))"))
        #expect(source.contains(".accessibilityElement(children: .ignore)"))
    }

    @Test("recap keeps the contribution and withdrawal as separate financial movements")
    func recap_separatesContributionAndWithdrawal() throws {
        let month = openMonth(amount: 200)
        let simulation = try SavingsPlanCalculator.simulate(
            timeline: [month],
            targetAmount: 10_000,
            adjustments: [.init(month: 6, year: 2026, amount: -500)],
            initialAmount: 10_000
        )
        let change = try #require(simulation.months.first)
        let breakdown = GoalPlanApplyRecapSheet.withdrawalBreakdown(for: change)

        #expect(breakdown.contribution == 200)
        #expect(breakdown.previousWithdrawal == 0)
        #expect(breakdown.plannedWithdrawal == -500)
        #expect(breakdown.netEffect == -300)
    }

    @Test("recap separates the contribution from a removed linked withdrawal")
    func recap_separatesContributionAndRemovedWithdrawal() throws {
        let change = SavingsPlanCalculator.SimulatedMonth(
            month: managedWithdrawalMonth(
                destination: .linkedIncome,
                remaining: 500,
                plannedAmount: 200
            ),
            simulatedAmount: 100,
            simulatedCumulative: 100,
            isAdjusted: true,
            replacesExistingPlanWithdrawal: true
        )
        let breakdown = GoalPlanApplyRecapSheet.withdrawalBreakdown(for: change)

        #expect(breakdown.contribution == 200)
        #expect(breakdown.updatedContribution == 100)
        #expect(breakdown.previousWithdrawal == -500)
        #expect(breakdown.plannedWithdrawal == 0)
        #expect(breakdown.netEffect == 100)

        let source = try Self.simulatorSource("GoalPlanApplyRecapSheet.swift")
        #expect(source.contains("simMonth.simulatedAmount < 0 || simMonth.replacesExistingPlanWithdrawal"))
        #expect(source.contains("change.month.planWithdrawalDestination == .linkedIncome"))
    }

    @Test("recap preserves mixed destinations and limits budget availability to each month")
    func recap_preservesMixedDestinationsAndLocalAvailability() throws {
        let existingGoalOnly = managedWithdrawalMonth(month: 6, destination: .goalOnly)
        let existingLinked = managedWithdrawalMonth(month: 7, destination: .linkedIncome)
        let simulation = try SavingsPlanCalculator.simulate(
            timeline: [existingGoalOnly, existingLinked],
            targetAmount: 20_000,
            adjustments: [
                .init(month: 6, year: 2026, amount: -3_000),
                .init(month: 7, year: 2026, amount: -2_000),
            ],
            initialAmount: 10_000
        )
        let changes = simulation.months.filter(\.isAdjusted)
        let destinations = GoalPlanApplyRecapSheet.initialWithdrawalDestinations(for: changes)

        #expect(destinations[existingGoalOnly.id] == .goalOnly)
        #expect(destinations[existingLinked.id] == .linkedIncome)

        let budgetMonths = try SavingsPlanCalculator.simulate(
            timeline: [
                openMonth(month: 8, amount: 200, hasBudget: true),
                openMonth(month: 9, amount: 200, hasBudget: false),
            ],
            targetAmount: 20_000,
            adjustments: [
                .init(month: 8, year: 2026, amount: -500),
                .init(month: 9, year: 2026, amount: -500),
            ],
            initialAmount: 10_000
        ).months

        #expect(GoalPlanApplyRecapSheet.canLinkWithdrawal(budgetMonths[0]))
        #expect(!GoalPlanApplyRecapSheet.canLinkWithdrawal(budgetMonths[1]))
    }

    @Test("recap keeps the already confirmed contribution in its withdrawal breakdown")
    func recap_keepsConfirmedContributionInWithdrawalBreakdown() throws {
        let month = openMonth(amount: 200, confirmedAmount: 350)
        let simulation = try SavingsPlanCalculator.simulate(
            timeline: [month],
            targetAmount: 10_000,
            adjustments: [.init(month: 6, year: 2026, amount: -500)],
            initialAmount: 10_000
        )
        let change = try #require(simulation.months.first)
        let breakdown = GoalPlanApplyRecapSheet.withdrawalBreakdown(for: change)

        #expect(breakdown.contribution == 350)
        #expect(breakdown.plannedWithdrawal == -500)
        #expect(breakdown.netEffect == -150)
    }

    @Test("recap shows every withdrawal while limiting other changes to five")
    func recap_listsAllWithdrawalsAndCapsOtherChanges() {
        let contributions = (1...6).map { month in
            SavingsPlanCalculator.SimulatedMonth(
                month: openMonth(month: month, amount: 200),
                simulatedAmount: 300,
                simulatedCumulative: 0,
                isAdjusted: true,
                replacesExistingPlanWithdrawal: false
            )
        }
        let withdrawals = (7...9).map { month in
            SavingsPlanCalculator.SimulatedMonth(
                month: openMonth(month: month, amount: 200),
                simulatedAmount: -500,
                simulatedCumulative: 0,
                isAdjusted: true,
                replacesExistingPlanWithdrawal: false
            )
        }

        let listed = GoalPlanApplyRecapSheet.listedChanges(
            contributions + withdrawals,
            maxNonWithdrawals: 5
        )

        #expect(listed.filter { $0.simulatedAmount >= 0 }.count == 5)
        #expect(listed.filter { $0.simulatedAmount < 0 }.map(\.id) == withdrawals.map(\.id))
    }

    @Test("recap describes a destination conversion for one month")
    func recap_describesDestinationConversion() {
        #expect(GoalPlanApplyRecapSheet.conversionMessage(
            from: .linkedIncome,
            to: .goalOnly
        ) == "La Prévision Revenu liée sera supprimée avec la mise à jour du plan.")
        #expect(GoalPlanApplyRecapSheet.conversionMessage(
            from: .goalOnly,
            to: .linkedIncome
        ) == "Une Prévision Revenu liée sera créée avec la mise à jour du plan.")
    }

    @Test("omits a zero-valued gap creation while keeping a zero-valued existing-line adjustment")
    func apply_omitsZeroGapCreation_keepsZeroLineAdjustment() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 200,
            initialAmount: 200,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()
        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(service.applyPlanCallCount == 1)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.budgetLineId == "\(Self.lineId)-6")
        #expect(payload.monthAdjustments.first?.amount == 0)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }

    @Test("keeps a zero deletion for an existing withdrawal on a provisionable month")
    func apply_keepsZeroWithdrawalDeletionOnProvisionableMonth() async throws {
        let service = MockSavingsGoalService()
        let month = managedWithdrawalMonth(
            month: 7,
            destination: .linkedIncome,
            plannedAmount: 0,
            isProvisionable: true,
            hasSavingLine: false
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [month]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: month.id, amount: 0)

        #expect(viewModel.planChanges.map(\.id) == [month.id])
        #expect(await viewModel.apply())
        let adjustment = try #require(service.lastApplyPayload?.planWithdrawalAdjustments.first)
        #expect(adjustment.amount == 0)
        #expect(adjustment.destination == .linkedIncome)
        #expect(service.lastApplyPayload?.missingMonthAdjustments.isEmpty == true)
    }

    @Test("keeps a valid adjustment when a zero-valued gap creation is dropped from the same submission")
    func apply_keepsValidAdjustment_besideDroppedZeroGap() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 0,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: 500)
        viewModel.redistribute()
        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.budgetLineId == "\(Self.lineId)-6")
        #expect(payload.monthAdjustments.first?.amount == 500)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }

    @Test("routes a negative month to the chosen linked-income destination without a saving line")
    func apply_routesSignedWithdrawalDestination() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [openMonth(amount: 1_260)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: -4_500)
        let succeeded = await viewModel.apply(withdrawalDestinations: [2026 * 12 + 6: .linkedIncome])
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.isEmpty)
        #expect(payload.planWithdrawalAdjustments.first?.amount == -4_500)
        #expect(payload.planWithdrawalAdjustments.first?.destination == .linkedIncome)
    }

    @Test("keeps a goal-only negative movement when the month has no budget")
    func apply_routesPlanOnlyWithdrawalWithoutBudget() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [gapMonth(hasBudget: false)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 7, amount: -450)
        let succeeded = await viewModel.apply(withdrawalDestinations: [2026 * 12 + 7: .linkedIncome])
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.isEmpty)
        #expect(payload.missingMonthAdjustments.isEmpty)
        #expect(payload.planWithdrawalAdjustments.first?.amount == -450)
        #expect(payload.planWithdrawalAdjustments.first?.destination == .goalOnly)
    }

    @Test("keeps an existing destination and defaults a new withdrawal to goal-only")
    func apply_preservesExistingDestinationAndDefaultsNewWithdrawal() async throws {
        let service = MockSavingsGoalService()
        let existing = managedWithdrawalMonth(month: 6, destination: .linkedIncome)
        let new = openMonth(month: 7, amount: 200)
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 20_000,
                initialAmount: 20_000,
                months: [existing, new]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )
        viewModel.setMonth(key: existing.id, amount: -3_000)
        viewModel.setMonth(key: new.id, amount: -500)

        #expect(await viewModel.apply())
        let payload = try #require(service.lastApplyPayload)
        let destinations = Dictionary(uniqueKeysWithValues: payload.planWithdrawalAdjustments.map {
            ($0.year * 12 + $0.month, $0.destination)
        })

        #expect(destinations[existing.id] == .linkedIncome)
        #expect(destinations[new.id] == .goalOnly)
    }

    @Test("routes mixed destinations by period key in one payload")
    func apply_routesMixedDestinationsByPeriod() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 20_000,
                initialAmount: 20_000,
                months: [
                    openMonth(month: 6, amount: 200),
                    openMonth(month: 7, amount: 200),
                ]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )
        viewModel.setMonth(key: 2026 * 12 + 6, amount: -500)
        viewModel.setMonth(key: 2026 * 12 + 7, amount: -700)

        #expect(await viewModel.apply(withdrawalDestinations: [
            2026 * 12 + 6: .goalOnly,
            2026 * 12 + 7: .linkedIncome,
        ]))
        let payload = try #require(service.lastApplyPayload)
        let destinations = Dictionary(uniqueKeysWithValues: payload.planWithdrawalAdjustments.map {
            ($0.year * 12 + $0.month, $0.destination)
        })

        #expect(destinations[2026 * 12 + 6] == .goalOnly)
        #expect(destinations[2026 * 12 + 7] == .linkedIncome)
    }

    @Test("a plan conflict invalidates the draft and prevents a stale second submission")
    func apply_planConflictInvalidatesDraft() async {
        let service = MockSavingsGoalService()
        service.error = APIError.from(
            code: "ERR_SAVINGS_GOAL_PLAN_CONFLICT",
            message: nil,
            statusCode: 409
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [openMonth(amount: 200)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )
        viewModel.setMonth(key: 2026 * 12 + 6, amount: -500)

        #expect(await viewModel.apply() == false)
        #expect(viewModel.didEncounterPlanConflict)
        #expect(viewModel.didApplySucceed == false)
        #expect(viewModel.canApply == false)
        #expect(await viewModel.apply() == false)
        #expect(service.applyPlanCallCount == 1)
    }
}

extension GoalPlanSimulatorTests {
    @Test(
        "global replacement keeps preview and payload aligned",
        arguments: [
            SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination.goalOnly,
            SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination.linkedIncome,
        ]
    )
    func globalReplacement_alignsPreviewAndPayload(
        destination: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination
    ) async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 20_000,
                initialAmount: 10_000,
                months: [managedWithdrawalMonth(destination: destination)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setGlobalAmount(1_260)
        #expect(viewModel.draft.simulatedFinal == 11_260)
        #expect(await viewModel.apply())
        #expect(service.lastApplyPayload?.planWithdrawalAdjustments.first?.amount == 0)
        #expect(service.lastApplyPayload?.planWithdrawalAdjustments.first?.destination == destination)

        let zeroService = MockSavingsGoalService()
        let zeroViewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 20_000,
                initialAmount: 10_000,
                months: [managedWithdrawalMonth(destination: destination)]
            ),
            currency: .chf,
            payDay: nil,
            service: zeroService
        )
        zeroViewModel.setGlobalAmount(0)
        #expect(zeroViewModel.draft.simulatedFinal == 10_000)
        #expect(await zeroViewModel.apply())
        #expect(zeroService.lastApplyPayload?.planWithdrawalAdjustments.first?.amount == 0)
        #expect(zeroService.lastApplyPayload?.planWithdrawalAdjustments.first?.destination == destination)
    }

    @Test("a positive amount equal to the old contribution still clears the current withdrawal")
    func setMonth_comparesWithCurrentMovement() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 20_000,
                initialAmount: 10_000,
                months: [managedWithdrawalMonth(destination: .linkedIncome)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: 1_260)

        #expect(viewModel.planChanges.count == 1)
        #expect(await viewModel.apply(withdrawalDestinations: [2026 * 12 + 6: .goalOnly]))
        #expect(service.lastApplyPayload?.planWithdrawalAdjustments.first?.amount == 0)
        #expect(service.lastApplyPayload?.planWithdrawalAdjustments.first?.destination == .linkedIncome)
    }

    @Test("keeps the global savings control non-negative without clamping")
    func globalAmount_rejectsNegativeValue() {
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 0,
                months: [openMonth(amount: 1_260)]
            ),
            currency: .chf,
            payDay: nil,
            service: MockSavingsGoalService()
        )

        viewModel.setGlobalAmount(300)
        viewModel.setGlobalAmount(-450)

        #expect(viewModel.globalAmount == 300)
        #expect(viewModel.draft.months.allSatisfy { $0.simulatedAmount == 300 })
    }

    @Test("skips the apply call when the only change is a zero-valued gap creation")
    func apply_skipsCall_whenOnlyChangeIsZeroGapCreation() async {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 500,
            months: [gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()
        let succeeded = await viewModel.apply()

        #expect(!succeeded)
        #expect(service.applyPlanCallCount == 0)
    }

    @Test("excludes a zero-valued gap creation from the recap preview, disabling apply")
    func planChanges_excludesZeroGapCreation_disablesApply() {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 500,
            months: [gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()

        #expect(viewModel.planChanges.isEmpty)
        #expect(!viewModel.canApply)
    }

    @Test("keeps only the valid adjustment in the recap preview, matching the payload")
    func planChanges_mixedZeroGapAndValidAdjustment_matchesPayload() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 0,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: 500)
        viewModel.redistribute()

        #expect(viewModel.planChanges.count == 1)
        #expect(viewModel.planChanges.first?.month.month == 6)
        #expect(viewModel.planChanges.first?.simulatedAmount == 500)

        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.amount == 500)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }
}
