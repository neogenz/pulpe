import { MAX_TAGS_PER_TRANSACTION, type Tag } from "pulpe-shared";

const NAME_MAX_LENGTH = 30;

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
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `${NAME_MAX_LENGTH} caractères maximum`;
  }
  if (findTagByName(trimmed, tags) !== undefined) return "Ce tag existe déjà";
  if (selectionCount >= MAX_TAGS_PER_TRANSACTION) {
    return `${MAX_TAGS_PER_TRANSACTION} tags maximum`;
  }
  return null;
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
