using System.Security.Cryptography;
using Pulpe.Domain.User;

namespace Pulpe.Api.Api.Middleware;

public class ClientKeyCleanupMiddleware
{
    private readonly RequestDelegate _next;

    public ClientKeyCleanupMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        finally
        {
            if (context.Items["AuthenticatedUser"] is AuthenticatedUser user)
                CryptographicOperations.ZeroMemory(user.ClientKey);
        }
    }
}
