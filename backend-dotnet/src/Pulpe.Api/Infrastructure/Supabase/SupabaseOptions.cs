namespace Pulpe.Api.Infrastructure.Supabase;

public sealed class SupabaseOptions
{
    public const string Section = "Supabase";
    public string Url { get; set; } = string.Empty;
    public string AnonKey { get; set; } = string.Empty;
    public string ServiceRoleKey { get; set; } = string.Empty;
}
