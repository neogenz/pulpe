using System.Text;
using System.Text.Json;

namespace Pulpe.Api.Infrastructure.Supabase;

public sealed class SupabaseQueryBuilder
{
    private readonly string _baseUrl;
    private readonly string _table;
    private readonly Dictionary<string, string> _headers;
    private readonly List<string> _queryParams = [];
    private string _method = "GET";
    private object? _body;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
    };

    internal SupabaseQueryBuilder(string baseUrl, string table, Dictionary<string, string> headers)
    {
        _baseUrl = baseUrl;
        _table = table;
        _headers = new Dictionary<string, string>(headers);
    }

    public SupabaseQueryBuilder Select(string columns = "*")
    {
        _queryParams.Add($"select={Uri.EscapeDataString(columns)}");
        return this;
    }

    public SupabaseQueryBuilder Eq(string column, object value)
    {
        _queryParams.Add($"{column}=eq.{Uri.EscapeDataString(value.ToString()!)}");
        return this;
    }

    public SupabaseQueryBuilder Neq(string column, object value)
    {
        _queryParams.Add($"{column}=neq.{Uri.EscapeDataString(value.ToString()!)}");
        return this;
    }

    public SupabaseQueryBuilder In(string column, IEnumerable<object> values)
    {
        var joined = string.Join(",", values.Select(v => Uri.EscapeDataString(v.ToString()!)));
        _queryParams.Add($"{column}=in.({joined})");
        return this;
    }

    public SupabaseQueryBuilder ILike(string column, string pattern)
    {
        _queryParams.Add($"{column}=ilike.{Uri.EscapeDataString(pattern)}");
        return this;
    }

    public SupabaseQueryBuilder Order(string column, bool ascending = true)
    {
        _queryParams.Add($"order={column}.{(ascending ? "asc" : "desc")}");
        return this;
    }

    public SupabaseQueryBuilder Limit(int count)
    {
        _queryParams.Add($"limit={count}");
        return this;
    }

    public SupabaseQueryBuilder Single()
    {
        _headers["Accept"] = "application/vnd.pgrst.object+json";
        return this;
    }

    public SupabaseQueryBuilder MaybeSingle()
    {
        _headers["Accept"] = "application/vnd.pgrst.object+json";
        _headers["Prefer"] = "return=representation";
        return this;
    }

    public SupabaseQueryBuilder Insert(object data)
    {
        _method = "POST";
        _body = data;
        _headers["Prefer"] = "return=representation";
        return this;
    }

    public SupabaseQueryBuilder Update(object data)
    {
        _method = "PATCH";
        _body = data;
        _headers["Prefer"] = "return=representation";
        return this;
    }

    public SupabaseQueryBuilder Delete()
    {
        _method = "DELETE";
        _headers["Prefer"] = "return=representation";
        return this;
    }

    internal (string Url, string Method, Dictionary<string, string> Headers, string? Body) Build()
    {
        var sb = new StringBuilder($"{_baseUrl}/rest/v1/{_table}");
        if (_queryParams.Count > 0)
        {
            sb.Append('?');
            sb.Append(string.Join("&", _queryParams));
        }

        string? body = null;
        if (_body is not null)
            body = JsonSerializer.Serialize(_body, JsonOptions);

        return (sb.ToString(), _method, _headers, body);
    }
}
