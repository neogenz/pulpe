using Supabase.Postgrest;

namespace Pulpe.Application.Common;

/// <summary>Creates Postgrest clients scoped to either service-role or request user.</summary>
public interface ISupabaseClientFactory
{
    /// <summary>Service-role client — bypasses RLS. Use for system ops only.</summary>
    Client CreateAdminClient();

    /// <summary>User-scoped client — enforces RLS via the current request's JWT.</summary>
    Client CreateUserClient();
}
