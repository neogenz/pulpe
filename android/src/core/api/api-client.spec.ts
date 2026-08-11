import { z } from "zod";

import { ApiClient, CLIENT_KEY_HEADER } from "./api-client";
import { CLIENT_ERROR_CODES, isApiError } from "./api-error";

const budgetsSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({ id: z.uuid(), month: z.number() })),
});

const VALID_PAYLOAD = {
  success: true,
  data: [{ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", month: 8 }],
};

/**
 * A `Response` body can only be consumed once, so a retried call needs a fresh
 * instance. Fixtures hand back a factory rather than a shared object.
 */
function jsonResponse(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

function createClient(
  fetchFn: jest.Mock,
  overrides: { clientKey?: string | null; token?: string | null } = {},
) {
  return new ApiClient({
    baseUrl: "https://api.test/api/v1",
    getAccessToken: () => overrides.token ?? "access-token",
    getClientKey: () => overrides.clientKey ?? null,
    retryBaseDelayMs: 0,
    fetchFn: fetchFn as unknown as typeof fetch,
  });
}

describe("ApiClient", () => {
  it("should return data validated by the shared schema", async () => {
    const fetchFn = jest.fn().mockImplementation(jsonResponse(VALID_PAYLOAD));

    const result = await createClient(fetchFn).get("/budgets", budgetsSchema);

    expect(result.data[0].month).toBe(8);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should send the bearer token and a request id on every call", async () => {
    const fetchFn = jest.fn().mockImplementation(jsonResponse(VALID_PAYLOAD));

    await createClient(fetchFn).get("/budgets", budgetsSchema);

    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer access-token");
    expect(headers["X-Request-Id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("should omit the client key header while the vault is locked", async () => {
    const fetchFn = jest.fn().mockImplementation(jsonResponse(VALID_PAYLOAD));

    await createClient(fetchFn).get("/budgets", budgetsSchema);

    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers[CLIENT_KEY_HEADER]).toBeUndefined();
  });

  it("should send the client key header once the vault is unlocked", async () => {
    const fetchFn = jest.fn().mockImplementation(jsonResponse(VALID_PAYLOAD));

    await createClient(fetchFn, { clientKey: "unlocked-key" }).get(
      "/budgets",
      budgetsSchema,
    );

    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers[CLIENT_KEY_HEADER]).toBe("unlocked-key");
  });

  it("should raise a typed parse error when the payload does not match", async () => {
    const fetchFn = jest
      .fn()
      .mockImplementation(
        jsonResponse({ success: true, data: "not-an-array" }),
      );

    const failure = await createClient(fetchFn)
      .get("/budgets", budgetsSchema)
      .catch((error: unknown) => error);

    expect(isApiError(failure)).toBe(true);
    expect(isApiError(failure) && failure.code).toBe(
      CLIENT_ERROR_CODES.ZOD_PARSE_ERROR,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should surface a 401 without retrying so the caller can sign out", async () => {
    const fetchFn = jest
      .fn()
      .mockImplementation(
        jsonResponse({ success: false, error: "Unauthorized" }, 401),
      );

    const failure = await createClient(fetchFn)
      .get("/budgets", budgetsSchema)
      .catch((error: unknown) => error);

    expect(isApiError(failure) && failure.status).toBe(401);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should retry a transient GET and succeed on a later attempt", async () => {
    const fetchFn = jest
      .fn()
      .mockImplementationOnce(jsonResponse({ error: "boom" }, 503))
      .mockImplementationOnce(jsonResponse(VALID_PAYLOAD));

    const result = await createClient(fetchFn).get("/budgets", budgetsSchema);

    expect(result.data).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("should give up after the retry budget and surface the last error", async () => {
    const fetchFn = jest
      .fn()
      .mockImplementation(jsonResponse({ error: "boom" }, 500));

    const failure = await createClient(fetchFn)
      .get("/budgets", budgetsSchema)
      .catch((error: unknown) => error);

    expect(isApiError(failure) && failure.status).toBe(500);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("should never replay a mutation", async () => {
    const fetchFn = jest
      .fn()
      .mockImplementation(jsonResponse({ error: "boom" }, 503));

    await createClient(fetchFn)
      .post("/budgets", { month: 8 }, budgetsSchema)
      .catch(() => undefined);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should validate the request body before sending it", async () => {
    const fetchFn = jest.fn();
    const requestSchema = z.strictObject({ month: z.number() });

    const failure = await createClient(fetchFn)
      .post(
        "/budgets",
        { month: 8, unexpected: true } as { month: number },
        budgetsSchema,
        requestSchema,
      )
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("should report an unreachable server in French", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(new TypeError("Network failed"));

    const failure = await createClient(fetchFn)
      .get("/budgets", budgetsSchema)
      .catch((error: unknown) => error);

    expect(isApiError(failure) && failure.code).toBe(
      CLIENT_ERROR_CODES.NETWORK_ERROR,
    );
    expect(isApiError(failure) && failure.message).toContain("connexion");
  });

  it("should append query parameters", async () => {
    const fetchFn = jest.fn().mockImplementation(jsonResponse(VALID_PAYLOAD));

    await createClient(fetchFn).get("/budgets", budgetsSchema, {
      limit: 12,
      year: 2026,
    });

    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://api.test/api/v1/budgets?limit=12&year=2026",
    );
  });
});
