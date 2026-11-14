import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { captureReminderOpened } from "@/core/observability/product-events";

import { reminderOfNotification } from "./scheduler";

/**
 * Counts the taps that bring the user back from a reminder, the retention
 * signal the reminders exist for. The last response also covers the tap that
 * cold-launched the app. Mirrors `ReminderTapHandler` on iOS.
 */
export function useReminderTapTracking(): void {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (
      response === null ||
      response === undefined ||
      response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      return;
    }
    const reminder = reminderOfNotification(
      response.notification.request.identifier,
    );
    if (reminder !== null) captureReminderOpened(reminder);
  }, [response]);
}
