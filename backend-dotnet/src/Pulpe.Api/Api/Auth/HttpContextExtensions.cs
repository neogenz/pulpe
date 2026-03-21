using Pulpe.Api.Domain.User;

namespace Pulpe.Api.Api.Auth;

public static class HttpContextExtensions
{
    public static AuthenticatedUser GetUser(this HttpContext ctx) =>
        ctx.Items["AuthenticatedUser"] as AuthenticatedUser
        ?? throw new InvalidOperationException("No authenticated user");

    public static object GetSupabaseClient(this HttpContext ctx) =>
        ctx.Items["SupabaseClient"]
        ?? throw new InvalidOperationException("No Supabase client");
}
