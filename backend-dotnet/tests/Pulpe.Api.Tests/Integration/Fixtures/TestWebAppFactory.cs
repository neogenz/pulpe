using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pulpe.Application.Encryption;
using Pulpe.Domain.User;

namespace Pulpe.Api.Tests.Integration.Fixtures;

/// <summary>
/// WebApplicationFactory that replaces the Supabase auth handler with a test handler.
/// The real IEncryptionAppService is replaced with a fake that returns canned responses.
/// </summary>
public sealed class TestWebAppFactory : WebApplicationFactory<Program>
{
    /// <summary>Set before each request to control which user is authenticated.</summary>
    public AuthenticatedUser? CurrentUser { get; set; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace real Supabase auth with test handler
            services.AddAuthentication("Test")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", null);

            services.PostConfigure<AuthenticationOptions>(opts =>
            {
                opts.DefaultAuthenticateScheme = "Test";
                opts.DefaultChallengeScheme = "Test";
            });

            // Replace IEncryptionAppService with a controllable stub
            services.RemoveAll<IEncryptionAppService>();
            services.AddScoped<IEncryptionAppService, FakeEncryptionAppService>();

            // Inject factory reference so TestAuthHandler can reach CurrentUser
            services.AddSingleton(this);

            // Remove and re-register RateLimiterOptions so tests don't hit 429.
            // We replace the rate limiter entirely with unlimited policies.
            services.RemoveAll<IConfigureOptions<RateLimiterOptions>>();
            services.RemoveAll<IPostConfigureOptions<RateLimiterOptions>>();
            services.AddRateLimiter(options =>
            {
                options.AddPolicy("default", _ => RateLimitPartition.GetNoLimiter("test"));
                options.AddPolicy("encryption-sensitive", _ => RateLimitPartition.GetNoLimiter("test"));
                options.AddPolicy("encryption-validate", _ => RateLimitPartition.GetNoLimiter("test"));
                options.AddPolicy("demo", _ => RateLimitPartition.GetNoLimiter("test"));
            });
        });

        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:Url"] = "http://localhost:54321",
                ["Supabase:AnonKey"] = "test-anon-key",
                ["Supabase:ServiceRoleKey"] = "test-service-role-key",
                ["Encryption:MasterKey"] = "0000000000000000000000000000000000000000000000000000000000000001",
                ["Turnstile:SecretKey"] = "test-turnstile-key",
                ["Cors:Origins"] = "http://localhost:4200"
            });
        });
    }

    public HttpClient CreateAuthenticatedClient(AuthenticatedUser user, string? clientKeyHex = null)
    {
        CurrentUser = user;
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", user.AccessToken);
        if (clientKeyHex is not null)
            client.DefaultRequestHeaders.Add("X-Client-Key", clientKeyHex);
        return client;
    }
}

/// <summary>Test auth handler that injects CurrentUser from TestWebAppFactory.</summary>
internal sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly TestWebAppFactory _factory;

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        TestWebAppFactory factory)
        : base(options, logger, encoder)
    {
        _factory = factory;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var user = _factory.CurrentUser;
        if (user is null)
            return Task.FromResult(AuthenticateResult.Fail("No test user set"));

        Context.Items["AuthenticatedUser"] = user;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email)
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

}

/// <summary>Fake IEncryptionAppService that returns canned responses without DB I/O.</summary>
internal sealed class FakeEncryptionAppService : IEncryptionAppService
{
    public Task<object> GetVaultStatusAsync(string userId) =>
        Task.FromResult<object>(new { PinCodeConfigured = false, RecoveryKeyConfigured = false, VaultCodeConfigured = false });

    public Task<object> GetSaltAsync(string userId) =>
        Task.FromResult<object>(new { Salt = "aabbcc", KdfIterations = 100_000, HasRecoveryKey = false });

    public Task ValidateKeyAsync(string userId, string clientKeyHex) =>
        Task.CompletedTask;

    public Task<object> SetupRecoveryAsync(string userId, byte[] clientKey) =>
        Task.FromResult<object>(new { RecoveryKey = "AAAA-BBBB-CCCC-DDDD" });

    public Task<object> RegenerateRecoveryAsync(string userId, byte[] clientKey) =>
        Task.FromResult<object>(new { RecoveryKey = "EEEE-FFFF-GGGG-HHHH" });

    public Task<object> RecoverAsync(string userId, string recoveryKey, string newClientKeyHex) =>
        Task.FromResult<object>(new { Success = true });

    public Task<object> ChangePinAsync(string userId, string oldClientKeyHex, string newClientKeyHex) =>
        Task.FromResult<object>(new { KeyCheck = "check", RecoveryKey = "IIII-JJJJ" });

    public Task VerifyRecoveryKeyAsync(string userId, string recoveryKey) =>
        Task.CompletedTask;
}
