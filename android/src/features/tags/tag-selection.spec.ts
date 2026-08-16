import { MAX_TAGS_PER_TRANSACTION, type Tag } from "pulpe-shared";

import {
  canCreateTag,
  findTagByName,
  tagNameIssue,
  tagsSelectedFirst,
  tagSummary,
  toggledTagIds,
} from "./tag-selection";

function tag(id: string, name: string): Tag {
  return {
    id,
    userId: "user-1",
    name,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const TAGS = [tag("tag-1", "Courses"), tag("tag-2", "Loisirs")];

describe("toggledTagIds", () => {
  it("adds a tag that is not selected", () => {
    expect(toggledTagIds("tag-2", ["tag-1"])).toEqual(["tag-1", "tag-2"]);
  });

  it("removes a tag that is selected", () => {
    expect(toggledTagIds("tag-1", ["tag-1", "tag-2"])).toEqual(["tag-2"]);
  });

  it("refuses to add past the server ceiling", () => {
    const full = Array.from(
      { length: MAX_TAGS_PER_TRANSACTION },
      (_, index) => `tag-${index}`,
    );

    expect(toggledTagIds("extra", full)).toEqual(full);
  });

  it("still removes when the selection is full", () => {
    const full = Array.from(
      { length: MAX_TAGS_PER_TRANSACTION },
      (_, index) => `tag-${index}`,
    );

    expect(toggledTagIds("tag-0", full)).toHaveLength(
      MAX_TAGS_PER_TRANSACTION - 1,
    );
  });
});

describe("tagsSelectedFirst", () => {
  it("brings a selected tag to the head of the row", () => {
    expect(tagsSelectedFirst(TAGS, ["tag-2"]).map((found) => found.id)).toEqual(
      ["tag-2", "tag-1"],
    );
  });

  it("keeps the given order among tags that share a state", () => {
    const many = [...TAGS, tag("tag-3", "Santé"), tag("tag-4", "Transport")];

    expect(
      tagsSelectedFirst(many, ["tag-4", "tag-1"]).map((found) => found.id),
    ).toEqual(["tag-1", "tag-4", "tag-2", "tag-3"]);
  });

  it("leaves an empty selection untouched", () => {
    expect(tagsSelectedFirst(TAGS, [])).toEqual(TAGS);
  });
});

describe("findTagByName", () => {
  it("matches whatever the casing", () => {
    expect(findTagByName("  cOuRsEs ", TAGS)?.id).toBe("tag-1");
  });

  it("returns nothing for a name no tag carries", () => {
    expect(findTagByName("Vacances", TAGS)).toBeUndefined();
  });
});

describe("tagNameIssue", () => {
  it("says nothing about an empty field", () => {
    expect(tagNameIssue("   ", TAGS, 0)).toBeNull();
  });

  it("rejects a name longer than thirty characters", () => {
    expect(tagNameIssue("a".repeat(31), TAGS, 0)).toBe("30 caractères maximum");
  });

  it("rejects a name already taken", () => {
    expect(tagNameIssue("courses", TAGS, 0)).toBe("Ce tag existe déjà");
  });

  it("rejects creating one more once the selection is full", () => {
    expect(tagNameIssue("Vacances", TAGS, MAX_TAGS_PER_TRANSACTION)).toBe(
      `${MAX_TAGS_PER_TRANSACTION} tags maximum`,
    );
  });

  it("accepts a fresh name", () => {
    expect(tagNameIssue("Vacances", TAGS, 1)).toBeNull();
  });
});

describe("tagSummary", () => {
  it("says nothing when a transaction carries no tag", () => {
    expect(tagSummary(undefined, TAGS)).toBeNull();
    expect(tagSummary([], TAGS)).toBeNull();
  });

  it("names the tags it has", () => {
    expect(tagSummary(["tag-1", "tag-2"], TAGS)).toBe("Courses, Loisirs");
  });

  it("counts the ones past the first two", () => {
    const many = [...TAGS, tag("tag-3", "Vacances"), tag("tag-4", "Cadeaux")];

    expect(tagSummary(["tag-1", "tag-2", "tag-3", "tag-4"], many)).toBe(
      "Courses, Loisirs +2",
    );
  });

  // A tag deleted elsewhere leaves its id behind until the next refetch.
  it("ignores an id no tag answers to", () => {
    expect(tagSummary(["tag-1", "gone"], TAGS)).toBe("Courses");
    expect(tagSummary(["gone"], TAGS)).toBeNull();
  });
});

describe("canCreateTag", () => {
  it("refuses an empty name even though it raises no issue", () => {
    expect(tagNameIssue("", TAGS, 0)).toBeNull();
    expect(canCreateTag("", TAGS, 0)).toBe(false);
  });

  it("accepts a fresh name", () => {
    expect(canCreateTag("Vacances", TAGS, 1)).toBe(true);
  });
});
