function setRequiredEnv(
  environment: "local" | "preview" | "production",
  apiBaseUrl: string,
): void {
  process.env.EXPO_PUBLIC_APP_ENV = environment;
  process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
}

function loadEnv(): typeof import("./env").ENV {
  let env: typeof import("./env").ENV | undefined;
  jest.isolateModules(() => {
    env = jest.requireActual<typeof import("./env")>("./env").ENV;
  });
  return env!;
}

describe("service URL configuration", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("accepts HTTPS in deployed environments", () => {
    setRequiredEnv("preview", "https://api.preview.pulpe.app");

    expect(loadEnv().apiBaseUrl).toBe("https://api.preview.pulpe.app");
  });

  it("rejects HTTP in deployed environments", () => {
    setRequiredEnv("production", "http://api.pulpe.app");

    expect(loadEnv).toThrow("must use HTTPS");
  });

  it("allows local HTTP only on a loopback host", () => {
    setRequiredEnv("local", "http://127.0.0.1:3000");
    expect(loadEnv().apiBaseUrl).toBe("http://127.0.0.1:3000");

    setRequiredEnv("local", "http://192.168.1.20:3000");
    expect(loadEnv).toThrow("must use HTTPS");
  });
});
