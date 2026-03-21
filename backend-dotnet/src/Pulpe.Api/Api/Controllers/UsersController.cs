using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Api.Application.User;
using Pulpe.Api.Application.User.Dto;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = HttpContext.GetUser();
        var result = await _userService.GetProfileAsync(user);
        return Ok(result);
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _userService.UpdateProfileAsync(user, dto);
        return Ok(result);
    }

    [HttpPut("onboarding-completed")]
    public async Task<IActionResult> CompleteOnboarding()
    {
        var user = HttpContext.GetUser();
        var result = await _userService.CompleteOnboardingAsync(user);
        return Ok(result);
    }

    [HttpGet("onboarding-status")]
    public async Task<IActionResult> GetOnboardingStatus()
    {
        var user = HttpContext.GetUser();
        var result = await _userService.GetOnboardingStatusAsync(user);
        return Ok(result);
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var user = HttpContext.GetUser();
        var result = await _userService.GetSettingsAsync(user);
        return Ok(result);
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateUserSettingsDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _userService.UpdateSettingsAsync(user, dto);
        return Ok(result);
    }

    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount()
    {
        var user = HttpContext.GetUser();
        await _userService.DeleteAccountAsync(user);
        return Ok(new { success = true });
    }
}
