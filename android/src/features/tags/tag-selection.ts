import { MAX_TAGS_PER_TRANSACTION, type Tag } from "pulpe-shared";

export const TAG_NAME_MAX_LENGTH = 30;
export type TagNameIssue = "tooLong" | "duplicate" | "selectionLimit";

/**
 * Adds or removes a tag, refusing to grow past the server's own ceiling — the
 * cap is enforced here rather than only disabling the rows, so a selection
 * carried over from an edited transaction can never exceed it either.
 */
export function toggledTagIds(
  tagId: string,
  selection: readonly string[],
): string[] {
  if (selection.includes(tagId)) {
    return selection.filter((id) => id !== tagId);
  }
  return selection.length >= MAX_TAGS_PER_TRANSACTION
    ? [...selection]
    : [...selection, tagId];
}

/**
 * The chosen tags first, everything else in its own order behind them.
 *
 * The picker is one scrolling row, so on a long list the two tags the user just
 * chose can end up several swipes off to the right — the selection would be
 * invisible on the very screen that sets it. Order is otherwise preserved, so
 * the list does not reshuffle under the finger as tags are toggled.
 */
export function tagsSelectedFirst(tags: Tag[], selection: string[]): Tag[] {
  const selected = tags.filter((tag) => selection.includes(tag.id));
  const rest = tags.filter((tag) => !selection.includes(tag.id));
  return [...selected, ...rest];
}

/** Case-insensitive, because the backend treats "Courses" and "courses" alike. */
export function findTagByName(name: string, tags: Tag[]): Tag | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return tags.find((tag) => tag.name.toLocaleLowerCase() === normalized);
}

/**
 * Why the typed name cannot become a tag, or null when it can. An empty field
 * is not an error — it is simply nothing typed yet, and saying so would put a
 * red line under a form the user has not started filling.
 */
export function tagNameIssue(
  name: string,
  tags: Tag[],
  selectionCount: number,
): TagNameIssue | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > TAG_NAME_MAX_LENGTH) return "tooLong";
  if (findTagByName(trimmed, tags) !== undefined) return "duplicate";
  if (selectionCount >= MAX_TAGS_PER_TRANSACTION) {
    return "selectionLimit";
  }
  return null;
}

const NAMES_SHOWN = 2;

/**
 * How a row states its tags: two names, then a count for the rest. Null when
 * there is nothing to say — including for an id no tag answers to, which
 * happens for a moment after a tag is deleted elsewhere.
 */
export function tagSummary(
  tagIds: string[] | undefined,
  tags: Tag[],
): string | null {
  if (tagIds === undefined || tagIds.length === 0) return null;

  const names = tagIds
    .map((id) => tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  if (names.length === 0) return null;

  const shown = names.slice(0, NAMES_SHOWN);
  const hidden = names.length - shown.length;
  return hidden > 0 ? `${shown.join(", ")} +${hidden}` : shown.join(", ");
}

export function canCreateTag(
  name: string,
  tags: Tag[],
  selectionCount: number,
): boolean {
  return (
    name.trim().length > 0 && tagNameIssue(name, tags, selectionCount) === null
  );
}
