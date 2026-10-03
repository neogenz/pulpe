import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { ForegroundRefresh } from "./foreground-refresh";

const mockSchedule = jest.fn(async (_payDay: number | null) => undefined);
const mockCheckSystemGate = jest.fn(async () => undefined);
let mockRemindersEnabled = true;
let mockSessionStatus = "authenticated";
let mockSettings: { payDayOfMonth: number | null } | undefined = {
  payDayOfMonth: 25,
};

jest.mock("@/core/notifications/scheduler", () => ({
  scheduleMonthlyReminder: (payDay: number | null) => mockSchedule(payDay),
}));
jest.mock("@/core/notifications/reminder-flags", () => ({
  readRemindersEnabled: () => mockRemindersEnabled,
}));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: mockSessionStatus }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({ data: mockSettings }),
}));
jest.mock("./system-store", () => ({
  checkSystemGate: () => mockCheckSystemGate(),
}));

let emitAppState: (state: AppStateStatus) => void = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockRemindersEnabled = true;
  mockSessionStatus = "authenticated";
  mockSettings = { payDayOfMonth: 25 };
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, handler) => {
    emitAppState = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => jest.restoreAllMocks());

async function foreground() {
  await act(async () => emitAppState("active"));
}

it("re-arms the reminder on the signed-in account's pay day, at launch and on return", async () => {
  await render(<ForegroundRefresh />);
  expect(mockSchedule).toHaveBeenLastCalledWith(25);

  await foreground();

  expect(mockSchedule).toHaveBeenCalledTimes(2);
  expect(mockCheckSystemGate).toHaveBeenCalledTimes(2);
});

it("never arms a reminder for a signed-out device", async () => {
  mockSessionStatus = "unauthenticated";
  mockSettings = undefined;

  await render(<ForegroundRefresh />);
  await foreground();

  expect(mockSchedule).not.toHaveBeenCalled();
  // The supported-build check is not an account's business: it still runs.
  expect(mockCheckSystemGate).toHaveBeenCalledTimes(2);
});

it("waits for the pay day rather than arming the 1st in its place", async () => {
  mockSettings = undefined;
  const view = await render(<ForegroundRefresh />);
  await foreground();
  expect(mockSchedule).not.toHaveBeenCalled();

  mockSettings = { payDayOfMonth: 27 };
  await view.rerender(<ForegroundRefresh />);

  expect(mockSchedule).toHaveBeenCalledTimes(1);
  expect(mockSchedule).toHaveBeenLastCalledWith(27);
});

it("leaves a reminder the user switched off alone", async () => {
  mockRemindersEnabled = false;

  await render(<ForegroundRefresh />);
  await foreground();

  expect(mockSchedule).not.toHaveBeenCalled();
});
