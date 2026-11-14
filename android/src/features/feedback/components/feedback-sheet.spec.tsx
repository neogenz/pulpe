import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { captureEvent } from "@/core/observability/analytics-client";

import { submitFeedback } from "../feedback-api";
import { FeedbackSheet } from "./feedback-sheet";

jest.mock("@/core/observability/analytics-client", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("../feedback-api", () => ({ submitFeedback: jest.fn() }));
jest.mock("../feedback-prompt", () => ({ markFeedbackSubmitted: jest.fn() }));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (select: (state: unknown) => unknown) =>
    select({ user: { id: "user-1" } }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/sheet", () => ({
  FormModal: ({
    title,
    footer,
    children,
  }: {
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const { View, Text } = jest.requireActual("react-native");
    return (
      <View>
        <Text>{title}</Text>
        {children}
        {footer}
      </View>
    );
  },
}));

function open(onDismiss = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <FeedbackSheet onDismiss={onDismiss} source={{ kind: "settings" }} />
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it("cannot be sent before an overall rating, and says it was opened", async () => {
  const view = await open();

  expect(view.getByText("settings.feedback.title")).toBeTruthy();
  expect(view.getByText("settings.feedback.send")).toBeDisabled();
  expect(captureEvent).toHaveBeenCalledWith("feedback_viewed", {
    source: "settings",
  });
});

it("sends the ratings to the API and only their shape to analytics", async () => {
  jest.mocked(submitFeedback).mockResolvedValue(undefined);
  const view = await open();

  await fireEvent.press(view.getByLabelText("settings.feedback.ratings.4"));
  await fireEvent.press(view.getByText("settings.feedback.detailsTitle"));
  await fireEvent.changeText(
    view.getByLabelText("settings.feedback.commentLabel"),
    "  secret comment  ",
  );
  await fireEvent.press(view.getByText("settings.feedback.send"));

  await waitFor(() =>
    expect(view.getByText("settings.feedback.thanks")).toBeTruthy(),
  );
  expect(jest.mocked(submitFeedback).mock.calls[0][0]).toMatchObject({
    overallRating: 4,
    comment: "secret comment",
    platform: "web",
  });
  expect(captureEvent).toHaveBeenCalledWith("feedback_submitted", {
    source: "settings",
    rating: 4,
    has_comment: true,
    has_details: false,
  });
  expect(JSON.stringify(jest.mocked(captureEvent).mock.calls)).not.toContain(
    "secret",
  );
});

it("reports a cancellation when closed unanswered", async () => {
  const onDismiss = jest.fn();
  const view = await open(onDismiss);

  await fireEvent.press(view.getByText("settings.feedback.later"));

  expect(captureEvent).toHaveBeenCalledWith("feedback_cancelled", {
    source: "settings",
  });
  expect(onDismiss).toHaveBeenCalled();
});

it("says so when the send failed", async () => {
  jest.mocked(submitFeedback).mockRejectedValue(new Error("offline"));
  const view = await open();

  await fireEvent.press(view.getByLabelText("settings.feedback.ratings.2"));
  await fireEvent.press(view.getByText("settings.feedback.send"));

  await waitFor(() =>
    expect(view.getByText("settings.feedback.error")).toBeTruthy(),
  );
});
