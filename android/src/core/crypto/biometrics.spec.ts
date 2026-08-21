import * as LocalAuthentication from "expo-local-authentication";

import { describeBiometrics } from "./biometrics";

jest.mock("expo-local-authentication", () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
}));

const mocked = jest.mocked(LocalAuthentication);

describe("describeBiometrics", () => {
  beforeEach(() => {
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
  });

  it.each([
    [[2], "face"],
    [[1], "fingerprint"],
    [[], "generic"],
  ] as const)("returns a stable kind for %p", async (types, expected) => {
    mocked.supportedAuthenticationTypesAsync.mockResolvedValue([...types]);
    await expect(describeBiometrics()).resolves.toBe(expected);
  });

  it("hides biometrics when none are enrolled", async () => {
    mocked.isEnrolledAsync.mockResolvedValue(false);
    mocked.supportedAuthenticationTypesAsync.mockResolvedValue([]);
    await expect(describeBiometrics()).resolves.toBeNull();
  });
});
