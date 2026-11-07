import Foundation
@testable import Pulpe
import Testing

/// The Mouvements chips and search, and the plain-language rows of « À faire ».
struct MovementsPageTests {
    private let planned = TestDataFactory.createTransaction(id: "a", budgetLineId: "line-1", name: "Café")
    private let free = TestDataFactory.createTransaction(id: "b", name: "Cinéma")
    private let pointedFree = TestDataFactory.createTransaction(id: "c", name: "Épicerie", isChecked: true)

    private var all: [Transaction] { [planned, free, pointedFree] }

    @Test("Each chip keeps and counts what it names")
    func chipsKeepAndCount() {
        #expect(MovementsFilter.all.count(in: all) == 3)
        #expect(MovementsFilter.unpointed.count(in: all) == 2)
        #expect(MovementsFilter.unplanned.count(in: all) == 2)
        let kept = MovementsFilter.apply(.unplanned, query: "", to: all, lineNames: [:])
        #expect(kept.map(\.id) == ["b", "c"])
    }

    @Test("Search ignores case and accents and reads the prévision's name too")
    func searchIsForgiving() {
        let byName = MovementsFilter.apply(.all, query: "epicerie", to: all, lineNames: [:])
        #expect(byName.map(\.id) == ["c"])
        let byLine = MovementsFilter.apply(.all, query: "LOYER", to: all, lineNames: ["line-1": "Loyer"])
        #expect(byLine.map(\.id) == ["a"])
        #expect(MovementsFilter.apply(.unpointed, query: "zzz", to: all, lineNames: [:]).isEmpty)
    }

    @Test("The title says « mouvements » only when no prévision is in the count")
    func toPointTitleNamesMovementsOnlyWhenTheyAreAll() {
        #expect(HomeTodoPresentation.toPointTitle(count: 4, includesForecasts: false).contains("mouvements"))
        #expect(!HomeTodoPresentation.toPointTitle(count: 17, includesForecasts: true).contains("mouvements"))
    }

    @Test("A movement with no prévision says « Hors prévision » on À pointer")
    func movementFactNamesItsPlace() {
        let fact = ToPointPresentation.movementFact(for: free, lineName: nil, pointedNow: true)
        #expect(fact.hasPrefix(PendingWording.unplanned))
        let planned = ToPointPresentation.movementFact(for: planned, lineName: "Courses", pointedNow: false)
        #expect(planned.hasPrefix("Courses"))
    }
}
