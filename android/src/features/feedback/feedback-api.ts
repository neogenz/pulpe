import {
  type FeedbackCreate,
  feedbackCreateSchema,
  feedbackStatusResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function submitFeedback(feedback: FeedbackCreate): Promise<void> {
  return api.postVoid(ENDPOINTS.feedback, feedback, feedbackCreateSchema);
}

/** Whether the account already answered, on any platform. */
export function fetchHasSubmittedFeedback(): Promise<boolean> {
  return api
    .get(ENDPOINTS.feedbackStatus, feedbackStatusResponseSchema)
    .then((response) => response.hasSubmitted);
}
