using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Infrastructure.Services.Template;
using Pulpe.Application.Template.Dto;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/budget-templates")]
[Authorize]
public class BudgetTemplatesController : ControllerBase
{
    private readonly ITemplateService _templateService;

    public BudgetTemplatesController(ITemplateService templateService)
    {
        _templateService = templateService;
    }

    [HttpGet]
    public async Task<IActionResult> FindAll()
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.FindAllAsync(user, supabase);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BudgetTemplateCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.CreateAsync(dto, user, supabase);
        return Created(string.Empty, result);
    }

    [HttpPost("from-onboarding")]
    public async Task<IActionResult> CreateFromOnboarding([FromBody] BudgetTemplateCreateFromOnboardingDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.CreateFromOnboardingAsync(dto, user, supabase);
        return Created(string.Empty, result);
    }

    [HttpGet("{id:guid}/usage")]
    public async Task<IActionResult> CheckUsage(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.CheckUsageAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.FindOneAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BudgetTemplateUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.UpdateAsync(id, dto, user, supabase);
        return Ok(result);
    }

    [HttpGet("{id:guid}/lines")]
    public async Task<IActionResult> FindTemplateLines(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.FindTemplateLinesAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpPatch("{id:guid}/lines")]
    public async Task<IActionResult> BulkUpdateTemplateLines(Guid id, [FromBody] TemplateLinesBulkUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.BulkUpdateTemplateLinesAsync(id, dto, user, supabase);
        return Ok(result);
    }

    [HttpPost("{id:guid}/lines/bulk-operations")]
    public async Task<IActionResult> BulkOperationsTemplateLines(Guid id, [FromBody] TemplateLinesBulkOperationsDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.BulkOperationsTemplateLinesAsync(id, dto, user, supabase);
        return Ok(result);
    }

    [HttpPost("{id:guid}/lines")]
    public async Task<IActionResult> CreateTemplateLine(Guid id, [FromBody] TemplateLineCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.CreateTemplateLineAsync(id, dto, user, supabase);
        return Created(string.Empty, result);
    }

    [HttpGet("{templateId:guid}/lines/{lineId:guid}")]
    public async Task<IActionResult> FindTemplateLine(Guid templateId, Guid lineId)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.FindTemplateLineAsync(lineId, user, supabase);
        return Ok(result);
    }

    [HttpPatch("{templateId:guid}/lines/{lineId:guid}")]
    public async Task<IActionResult> UpdateTemplateLine(Guid templateId, Guid lineId, [FromBody] TemplateLineUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.UpdateTemplateLineAsync(lineId, dto, user, supabase);
        return Ok(result);
    }

    [HttpDelete("{templateId:guid}/lines/{lineId:guid}")]
    public async Task<IActionResult> DeleteTemplateLine(Guid templateId, Guid lineId)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.DeleteTemplateLineAsync(lineId, user, supabase);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _templateService.RemoveAsync(id, user, supabase);
        return Ok(result);
    }
}
