import Foundation
@testable import Pulpe
import Testing

@Suite("TagPickerField Tests")
@MainActor
struct TagPickerFieldTests {
    @Test("Names are trimmed and exact duplicates ignore case")
    func nameValidation() {
        let tag = Tag(
            id: "tag-1",
            userId: "user-1",
            name: "Courses",
            createdAt: .distantPast,
            updatedAt: .distantPast
        )

        #expect(TagPickerField.normalizedName("  Courses \n") == "Courses")
        #expect(TagPickerField.duplicate(named: "courses", in: [tag])?.id == tag.id)
        #expect(TagPickerField.duplicate(named: "Course", in: [tag]) == nil)
        #expect(TagPickerField.hasValidLength(" ") == false)
        #expect(TagPickerField.hasValidLength(String(repeating: "a", count: 30)))
        #expect(TagPickerField.hasValidLength(String(repeating: "a", count: 31)) == false)
    }

    @Test("Selection is unique and capped at ten tags")
    func selectionLimit() {
        let tenTags = Set((0..<AppConfiguration.maxTagsPerTransaction).map { "tag-\($0)" })

        #expect(TagPickerField.toggledTag("tag-0", in: tenTags).count == 9)
        #expect(TagPickerField.toggledTag("tag-10", in: tenTags) == tenTags)
        #expect(TagPickerField.toggledTag("tag-1", in: ["tag-1"]) == [])
    }

    @Test("The field summary stays compact beyond two tags")
    func compactSummary() {
        #expect(TagPickerField.summary(selectedNames: [], selectionCount: 0) == "Aucun tag")
        #expect(TagPickerField.summary(selectedNames: [], selectionCount: 3) == "3 tags")
        #expect(
            TagPickerField.summary(
                selectedNames: ["Alimentation", "Maison", "Week-end", "Vacances"],
                selectionCount: 4
            ) == "Alimentation, Maison +2"
        )
    }

    @Test("PATCH omits unchanged tags and sends an empty array when detached")
    func patchSemantics() {
        let initial: Set<String> = ["tag-2", "tag-1"]

        #expect(TagPickerField.updatedTagIds(initial: initial, current: initial) == nil)
        #expect(TagPickerField.updatedTagIds(initial: initial, current: []) == [])
        #expect(TagPickerField.updatedTagIds(initial: initial, current: ["tag-3"]) == ["tag-3"])
    }

    @Test("Creation payload omits an empty selection and a created tag is selected")
    func creationSemantics() {
        let tag = Tag(
            id: "tag-2",
            userId: "user-1",
            name: "Vacances",
            createdAt: .distantPast,
            updatedAt: .distantPast
        )

        #expect(TagPickerField.createdTagIds(from: []) == nil)
        #expect(TagPickerField.createdTagIds(from: ["tag-2", "tag-1"]) == ["tag-1", "tag-2"])
        #expect(TagPickerField.selection(afterCreating: tag, current: ["tag-1"]) == ["tag-1", "tag-2"])

        let fullSelection = Set((0..<AppConfiguration.maxTagsPerTransaction).map { "tag-\($0)" })
        let eleventhTag = Tag(
            id: "tag-10",
            userId: "user-1",
            name: "Onzième",
            createdAt: .distantPast,
            updatedAt: .distantPast
        )
        #expect(TagPickerField.selection(afterCreating: eleventhTag, current: fullSelection) == fullSelection)
    }
}
