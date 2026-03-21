namespace Pulpe.Api.Application.Demo;

public interface IDemoService
{
    Task<object> CreateSessionAsync(string turnstileToken);
    Task CleanupAsync();
}
