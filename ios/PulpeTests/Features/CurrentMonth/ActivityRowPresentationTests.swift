@testable import Pulpe
import Testing

/// The Home lists allocated and free movements together, so a row that consumes
/// no forecast has to say so — and only there: the budget detail groups them
/// under a section title that already carries the word.
@Suite("Activity row presentation")
struct ActivityRowPresentationTests {
    @Test("a movement attached to no forecast says it is out of plan")
    func outOfPlanMarker_whenFree_statesIt() {
        let free = TestDataFactory.createTransaction(budgetLineId: nil)

        #expect(ActivityCard.outOfPlanMarker(for: free) == "Hors prévision")
    }

    @Test("a movement consuming a forecast says nothing extra")
    func outOfPlanMarker_whenAllocated_returnsNil() {
        let allocated = TestDataFactory.createTransaction(budgetLineId: "line-1")

        #expect(ActivityCard.outOfPlanMarker(for: allocated) == nil)
    }

    @Test("the marker and the savings provenance do not replace one another")
    func outOfPlanMarker_whenFreeWithSavingsSource_bothFactsSurvive() {
        let free = TestDataFactory.createTransaction(
            budgetLineId: nil,
            sourceSavingsGoalId: "goal-1",
            sourceSavingsGoalName: "Voiture"
        )

        #expect(ActivityCard.outOfPlanMarker(for: free) == "Hors prévision")
        #expect(free.savingsGoalSource != nil)
    }
}
