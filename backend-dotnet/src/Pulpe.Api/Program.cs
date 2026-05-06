using System.Threading.RateLimiting;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.OpenApi;
using Pulpe.Api.Api.Auth;
using Pulpe.Api.Api.Filters;
using Pulpe.Api.Api.Middleware;
using Pulpe.Application.Budget;
using Pulpe.Application.Common;
using Pulpe.Application.User;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Template;
using Pulpe.Domain.Transaction;
using Pulpe.Api.HostedServices;
using Pulpe.Infrastructure.Cache;
using Pulpe.Infrastructure.Encryption;
using Pulpe.Infrastructure.Services.AccountDeletion;
using Pulpe.Infrastructure.Services.Budget;
using Pulpe.Infrastructure.Services.BudgetLine;
using Pulpe.Infrastructure.Services.Demo;
using Pulpe.Infrastructure.Services.Encryption;
using Pulpe.Infrastructure.Services.Template;
using Pulpe.Infrastructure.Services.Transaction;
using Pulpe.Infrastructure.Services.User;
using Pulpe.Infrastructure.Supabase;
using Pulpe.Infrastructure.Supabase.Repositories;
using Pulpe.Infrastructure.Turnstile;
using Serilog;

using IBudgetRecalculationService = Pulpe.Application.Common.IBudgetRecalculationService;
using IBudgetAppService = Pulpe.Infrastructure.Services.Budget.IBudgetService;

var builder = WebApplication.CreateBuilder(args);

// 1. Serilog
builder.Host.UseSerilog((context, config) =>
{
    config
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Destructure.ByTransforming<Dictionary<string, object?>>(dict =>
        {
            var sensitiveKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "authorization", "cookie", "x-client-key", "set-cookie",
                "password", "clientKey", "client_key", "newClientKey", "new_client_key",
                "oldClientKey", "old_client_key", "recoveryKey", "recovery_key",
                "token", "accessToken", "access_token", "refreshToken", "refresh_token",
                "secret"
            };
            return dict.ToDictionary(
                kv => kv.Key,
                kv => sensitiveKeys.Contains(kv.Key) ? (object?)"[REDACTED]" : kv.Value);
        })
        .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}");
});

// 2. Configuration binding
builder.Services.Configure<SupabaseOptions>(builder.Configuration.GetSection(SupabaseOptions.Section));
builder.Services.Configure<EncryptionOptions>(builder.Configuration.GetSection(EncryptionOptions.Section));

// Startup validation — fail fast if critical secrets are missing
var supabaseUrl = builder.Configuration["Supabase:Url"];
if (string.IsNullOrWhiteSpace(supabaseUrl) || !Uri.TryCreate(supabaseUrl, UriKind.Absolute, out _))
    throw new InvalidOperationException("Supabase:Url must be a valid absolute URL (e.g. http://127.0.0.1:54321)");

var serviceRoleKey = builder.Configuration["Supabase:ServiceRoleKey"];
if (string.IsNullOrWhiteSpace(serviceRoleKey))
    throw new InvalidOperationException("Supabase:ServiceRoleKey is required");

var anonKey = builder.Configuration["Supabase:AnonKey"];
if (string.IsNullOrWhiteSpace(anonKey))
    throw new InvalidOperationException("Supabase:AnonKey is required");

var masterKey = builder.Configuration["Encryption:MasterKey"];
if (string.IsNullOrEmpty(masterKey) || masterKey.Length != 64 || !masterKey.All(c => Uri.IsHexDigit(c)))
    throw new InvalidOperationException("Encryption:MasterKey must be exactly 64 hex characters (32 bytes)");

// 3. Infrastructure services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<SupabaseClientFactory>();
builder.Services.AddSingleton<SupabaseAuthClient>();
builder.Services.AddSingleton<IEncryptionService, AesGcmEncryptionService>();
builder.Services.AddSingleton<IEncryptionKeyRepository, EncryptionKeyRepository>();
builder.Services.AddSingleton<ICacheService, InMemoryCacheService>();
builder.Services.AddSingleton<ITurnstileService, TurnstileService>();
builder.Services.AddSingleton<IUserMetadataService, SupabaseUserMetadataService>();

// 4. Application services — repositories
builder.Services.AddScoped<IBudgetRepository, BudgetRepository>();
builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
builder.Services.AddScoped<ITemplateRepository, TemplateRepository>();

// Budget services
builder.Services.AddScoped<BudgetCalculator>();
builder.Services.AddScoped<BudgetValidator>();
builder.Services.AddScoped<BudgetService>();
builder.Services.AddScoped<IBudgetAppService>(sp => sp.GetRequiredService<BudgetService>());
builder.Services.AddScoped<IBudgetRecalculationService>(sp => sp.GetRequiredService<BudgetService>());

// BudgetLine service
builder.Services.AddScoped<BudgetLineService>();
builder.Services.AddScoped<IBudgetLineService>(sp => sp.GetRequiredService<BudgetLineService>());

// Transaction service
builder.Services.AddScoped<TransactionService>();
builder.Services.AddScoped<ITransactionService>(sp => sp.GetRequiredService<TransactionService>());

// Template service
builder.Services.AddScoped<BudgetTemplateService>();
builder.Services.AddScoped<ITemplateService>(sp => sp.GetRequiredService<BudgetTemplateService>());

// User service
builder.Services.AddScoped<IUserService, UserService>();

// Encryption app service
builder.Services.AddScoped<IEncryptionAppService, EncryptionAppService>();

// Demo services
builder.Services.AddScoped<DemoDataGeneratorService>();
builder.Services.AddScoped<DemoService>();
builder.Services.AddScoped<DemoCleanupService>();

// Account deletion
builder.Services.AddScoped<AccountDeletionService>();

// 5. Authentication — Custom Supabase handler
builder.Services.AddAuthentication("Supabase")
    .AddScheme<AuthenticationSchemeOptions, SupabaseAuthenticationHandler>("Supabase", null);
builder.Services.AddAuthorization();

// 6. Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    // Global rate limit — 200 req/min per authenticated user (or IP for anon)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 200,
                Window = TimeSpan.FromMinutes(1)
            }));

    // Stricter limit for unauthenticated requests in production
    options.AddPolicy("public", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("encryption-validate", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("encryption-sensitive", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1)
            }));

    options.AddPolicy("demo", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromHours(1)
            }));
});

// 7. Memory cache
builder.Services.AddMemoryCache();

// 8. Controllers + FluentValidation + Swagger
builder.Services.AddControllers(options =>
{
    options.Filters.Add<GlobalExceptionFilter>();
    options.Filters.Add<ResponseWrapperActionFilter>();
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never;
    options.JsonSerializerOptions.Converters.Add(
        new System.Text.Json.Serialization.JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.SnakeCaseLower));
});
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Pulpe API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", doc),
            new List<string>()
        }
    });
});

// 9. CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var corsOrigins = builder.Configuration["Cors:Origins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var env = builder.Environment;

        if (env.IsProduction())
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (corsOrigins?.Contains(origin) == true) return true;
                return System.Text.RegularExpressions.Regex.IsMatch(origin,
                    @"^https://pulpe-frontend-[a-z0-9-]+-maximes-projects-[a-z0-9]+\.vercel\.app$");
            });
        }
        else
        {
            policy.SetIsOriginAllowed(_ => true);
        }

        policy.WithMethods("GET", "POST", "PUT", "DELETE", "PATCH")
              .WithHeaders("Content-Type", "Authorization", "X-Client-Key", "ngrok-skip-browser-warning")
              .AllowCredentials();
    });
});

// 10. Response compression
builder.Services.AddResponseCompression();

// 11. Health checks
builder.Services.AddHealthChecks();

// 12. Hosted services
builder.Services.AddHostedService<DemoCleanupHostedService>();
builder.Services.AddHostedService<AccountDeletionHostedService>();

var app = builder.Build();

// --- Middleware Pipeline (ORDER MATTERS) ---

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "0";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

app.UseMiddleware<IpBlacklistMiddleware>();
app.UseMiddleware<MaintenanceMiddleware>();
app.UseResponseCompression();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<PayloadSizeMiddleware>();
app.UseMiddleware<ClientKeyCleanupMiddleware>();

if (!app.Environment.IsProduction())
{
    app.UseSwagger(c => c.RouteTemplate = "api/{documentName}/openapi.json");
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/api/v1/openapi.json", "Pulpe API v1");
        c.RoutePrefix = "docs";
    });
}

app.MapGet("/", () => Results.Json(new { message = "Pulpe API", status = "running" }));
app.MapGet("/health", () => Results.Json(new { status = "healthy" }));
app.MapGet("/api/v1/maintenance/status", (IConfiguration config) =>
    Results.Json(new
    {
        maintenanceMode = config["MAINTENANCE_MODE"] == "true",
        message = config["MAINTENANCE_MODE"] == "true" ? "Service is under maintenance" : "Service is running normally"
    }));

app.MapControllers();
app.MapHealthChecks("/healthz");

var port = Environment.GetEnvironmentVariable("PORT") ?? "3000";
app.Urls.Add($"http://+:{port}");

app.Run();

public partial class Program { }
