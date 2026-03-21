namespace Pulpe.Api.Infrastructure.Supabase;

public sealed class SupabaseResponse<T>
{
    public T? Data { get; set; }
    public SupabaseError? Error { get; set; }
    public bool IsSuccess => Error is null;
}

public sealed class SupabaseError
{
    public string? Message { get; set; }
    public string? Code { get; set; }
    public string? Details { get; set; }
    public string? Hint { get; set; }
}
