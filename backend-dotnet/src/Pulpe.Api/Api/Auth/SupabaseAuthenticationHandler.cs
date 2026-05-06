using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Pulpe.Domain.Common;
using Pulpe.Domain.User;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Api.Api.Auth;

public class SupabaseAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly SupabaseAuthClient _authClient;
    private readonly SupabaseClientFactory _clientFactory;

    public SupabaseAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        SupabaseAuthClient authClient,
        SupabaseClientFactory clientFactory)
        : base(options, logger, encoder)
    {
        _authClient = authClient;
        _clientFactory = clientFactory;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = ExtractBearerToken();
        if (token is null)
            return AuthenticateResult.Fail(ErrorCodes.AuthTokenMissing);

        SupabaseUser? user;
        try
        {
            user = await _authClient.GetUser<SupabaseUser>(token);
        }
        catch
        {
            return AuthenticateResult.Fail(ErrorCodes.AuthTokenInvalid);
        }

        if (user is null || string.IsNullOrEmpty(user.Id))
            return AuthenticateResult.Fail(ErrorCodes.AuthTokenInvalid);

        if (!string.IsNullOrEmpty(user.UserMetadata?.ScheduledDeletionAt))
        {
            return AuthenticateResult.Fail(ErrorCodes.UserAccountBlocked);
        }

        byte[] clientKey;
        try
        {
            clientKey = ResolveClientKey();
        }
        catch (BusinessException ex)
        {
            return AuthenticateResult.Fail(ex.Code);
        }

        var authenticatedUser = new AuthenticatedUser
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FirstName = user.UserMetadata?.FirstName,
            LastName = user.UserMetadata?.LastName,
            AccessToken = token,
            ClientKey = clientKey
        };

        Context.Items["AuthenticatedUser"] = authenticatedUser;
        Context.Items["SupabaseClient"] = _clientFactory.CreateAuthenticated(token);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email ?? string.Empty)
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }

    private string? ExtractBearerToken()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        return authHeader["Bearer ".Length..].Trim();
    }

    private byte[] ResolveClientKey()
    {
        var endpoint = Context.GetEndpoint();
        var skipClientKey = endpoint?.Metadata.GetMetadata<SkipClientKeyAttribute>() is not null;

        if (skipClientKey)
            return new byte[32];

        return ExtractClientKey();
    }

    private byte[] ExtractClientKey()
    {
        var clientKeyHex = Request.Headers["X-Client-Key"].ToString();

        if (string.IsNullOrEmpty(clientKeyHex))
        {
            throw new BusinessException(
                ErrorCodes.AuthClientKeyMissing,
                "Missing X-Client-Key header",
                401);
        }

        if (clientKeyHex.Length != 64 || !IsValidHex(clientKeyHex))
        {
            throw new BusinessException(
                ErrorCodes.AuthClientKeyInvalid,
                "X-Client-Key must be a 64-character hex string (32 bytes)",
                401);
        }

        var keyBytes = Convert.FromHexString(clientKeyHex);

        if (keyBytes.All(b => b == 0))
        {
            throw new BusinessException(
                ErrorCodes.AuthClientKeyInvalid,
                "X-Client-Key must not be all zeros",
                401);
        }

        return keyBytes;
    }

    private static bool IsValidHex(string value)
    {
        foreach (var c in value)
        {
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
                return false;
        }
        return true;
    }
}

