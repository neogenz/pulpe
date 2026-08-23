import { API_ERROR_CODES } from "pulpe-shared";

import { ApiError, CLIENT_ERROR_CODES } from "@/core/api/api-error";

import { reportApiError } from "./api-error-reporting";
import { captureException } from "./analytics";

jest.mock("./analytics", () => ({ captureException: jest.fn() }));

const mockedCapture = jest.mocked(captureException);

describe("API error reporting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("captures only filtered technical correlation data", () => {
    reportApiError(
      new ApiError(
        "backend secret message",
        "ERR_BUDGET_FETCH_FAILED",
        503,
        { amount: 1200 },
        "request-42",
      ),
      {
        method: "get",
        path: "/budgets/3fa85f64-5717-4562-b3fc-2c963f66afa6?name=secret",
      },
    );

    expect(mockedCapture).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ApiRequestError" }),
      {
        http_method: "GET",
        http_status: 503,
        request_path: "/budgets/:id",
        error_code: "ERR_BUDGET_FETCH_FAILED",
        request_id: "request-42",
      },
    );
    expect(JSON.stringify(mockedCapture.mock.calls)).not.toMatch(
      /backend secret|1200|name=secret/,
    );
  });

  it.each([
    [0, CLIENT_ERROR_CODES.NETWORK_ERROR],
    [0, CLIENT_ERROR_CODES.TIMEOUT],
    [401, undefined],
    [403, undefined],
    [429, undefined],
    [503, "MAINTENANCE"],
    [400, API_ERROR_CODES.RECOVERY_KEY_INVALID],
    [404, API_ERROR_CODES.RECOVERY_KEY_NOT_CONFIGURED],
    [400, API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED],
  ])("ignores expected status %s and code %s", (status, code) => {
    reportApiError(new ApiError("expected", code, status, undefined), {
      method: "POST",
      path: "/encryption/recover",
    });

    expect(mockedCapture).not.toHaveBeenCalled();
  });
});
