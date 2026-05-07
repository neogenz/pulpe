namespace Pulpe.Application.Common;

public interface ISupabaseAuthClient
{
    Task<T?> GetUser<T>(string accessToken);
    Task<T?> AdminGetUser<T>(string userId);
    Task<T?> AdminUpdateUser<T>(string userId, object metadata);
    Task AdminDeleteUser(string userId);
    Task<T?> AdminListUsers<T>(int page = 1, int perPage = 50);
    Task AdminSignOut(string token, string scope = "global");
    Task<T?> SignInWithPassword<T>(string email, string password);
    Task<T?> AdminCreateUser<T>(object data);
}
