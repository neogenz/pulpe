using Microsoft.Extensions.Logging;
using Pulpe.Application.Demo.Dto;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Infrastructure.Services.Demo;

public sealed class DemoService
{
    private readonly SupabaseClientFactory _clientFactory;
    private readonly SupabaseAuthClient _authClient;
    private readonly DemoDataGeneratorService _dataGenerator;
    private readonly ILogger<DemoService> _logger;

    public DemoService(
        SupabaseClientFactory clientFactory,
        SupabaseAuthClient authClient,
        DemoDataGeneratorService dataGenerator,
        ILogger<DemoService> logger)
    {
        _clientFactory = clientFactory;
        _authClient = authClient;
        _dataGenerator = dataGenerator;
        _logger = logger;
    }

    public async Task<DemoSessionResponseDto> CreateDemoSession()
    {
        var startTime = DateTimeOffset.UtcNow;
        var demoEmail = $"demo-{Guid.NewGuid()}@pulpe-demo.local";
        var demoPassword = Guid.NewGuid().ToString();

        _logger.LogInformation("Creating demo user {Email}", demoEmail);

        var createResult = await _authClient.AdminCreateUser<AdminUserResponse>(new
        {
            email = demoEmail,
            password = demoPassword,
            email_confirm = true,
            user_metadata = new
            {
                is_demo = true,
                created_at = DateTimeOffset.UtcNow.ToString("O"),
                name = "Utilisateur de test"
            }
        });

        if (createResult is null || string.IsNullOrEmpty(createResult.Id))
            throw new InvalidOperationException("Failed to create demo user");

        var userId = createResult.Id;
        _logger.LogInformation("Demo user created {UserId}", userId);

        var signInResult = await _authClient.SignInWithPassword<SignInResponse>(demoEmail, demoPassword);
        if (signInResult is null || string.IsNullOrEmpty(signInResult.AccessToken))
        {
            await _authClient.AdminDeleteUser(userId);
            throw new InvalidOperationException("Failed to sign in demo user");
        }

        _logger.LogInformation("Demo session created for user {UserId}", userId);

        var authenticatedClient = _clientFactory.CreateAuthenticated(signInResult.AccessToken);
        await SeedDemoDataSafely(userId, authenticatedClient, startTime);

        return new DemoSessionResponseDto(
            Success: true,
            Data: new DemoSessionData(new DemoSession(
                AccessToken: signInResult.AccessToken,
                TokenType: "bearer",
                ExpiresIn: signInResult.ExpiresIn ?? 3600,
                ExpiresAt: signInResult.ExpiresAt ?? 0,
                RefreshToken: signInResult.RefreshToken ?? string.Empty,
                User: new DemoUser(
                    Id: userId,
                    Email: demoEmail,
                    CreatedAt: createResult.CreatedAt ?? DateTimeOffset.UtcNow))),
            Message: "Demo session created successfully");
    }

    private async Task SeedDemoDataSafely(string userId, SupabaseRestClient client, DateTimeOffset startTime)
    {
        try
        {
            await _dataGenerator.SeedDemoData(userId, client);
            _logger.LogInformation(
                "Demo data seeded for user {UserId}, duration {Duration}ms",
                userId, (DateTimeOffset.UtcNow - startTime).TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to seed demo data for user {UserId}, but session is valid", userId);
        }
    }

    private sealed class AdminUserResponse
    {
        public string Id { get; set; } = string.Empty;
        public string? Email { get; set; }
        public DateTimeOffset? CreatedAt { get; set; }
    }

    private sealed class SignInResponse
    {
        public string? AccessToken { get; set; }
        public string? TokenType { get; set; }
        public int? ExpiresIn { get; set; }
        public long? ExpiresAt { get; set; }
        public string? RefreshToken { get; set; }
    }
}
