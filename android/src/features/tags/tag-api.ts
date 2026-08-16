import {
  type Tag,
  type TagCreate,
  tagCreateSchema,
  tagListResponseSchema,
  tagResponseSchema,
  type TagUpdate,
  tagUpdateSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchTags(): Promise<Tag[]> {
  return api
    .get(ENDPOINTS.tags, tagListResponseSchema)
    .then((response) => response.data);
}

export function createTag(name: string): Promise<Tag> {
  return api
    .post<
      { data: Tag },
      TagCreate
    >(ENDPOINTS.tags, { name }, tagResponseSchema, tagCreateSchema)
    .then((response) => response.data);
}

export function renameTag(input: {
  tagId: string;
  name: string;
}): Promise<Tag> {
  return api
    .patch<
      { data: Tag },
      TagUpdate
    >(ENDPOINTS.tag(input.tagId), { name: input.name }, tagResponseSchema, tagUpdateSchema)
    .then((response) => response.data);
}

/**
 * Deleting a tag detaches it everywhere it was used; the forecasts and
 * operations themselves stay where they are.
 */
export function deleteTag(tagId: string): Promise<void> {
  return api.deleteVoid(ENDPOINTS.tag(tagId));
}
