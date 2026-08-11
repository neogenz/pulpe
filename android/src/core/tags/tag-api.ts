import {
  type Tag,
  type TagCreate,
  tagCreateSchema,
  tagListResponseSchema,
  tagResponseSchema,
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
