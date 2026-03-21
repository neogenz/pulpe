using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Pulpe.Api.Api.Filters;
using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Tests.Api;

public class GlobalExceptionFilterTests
{
    private readonly IWebHostEnvironment _env = Substitute.For<IWebHostEnvironment>();
    private readonly GlobalExceptionFilter _sut;

    public GlobalExceptionFilterTests()
    {
        _env.EnvironmentName.Returns("Production");
        _sut = new GlobalExceptionFilter(NullLogger<GlobalExceptionFilter>.Instance, _env);
    }

    private static ExceptionContext MakeContext(Exception ex)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = "/api/test";
        httpContext.Request.Method = "GET";

        var actionContext = new ActionContext(httpContext, new Microsoft.AspNetCore.Routing.RouteData(), new Microsoft.AspNetCore.Mvc.Abstractions.ActionDescriptor());
        return new ExceptionContext(actionContext, new List<IFilterMetadata>())
        {
            Exception = ex
        };
    }

    // --- BusinessException ---

    [Fact]
    public void OnException_BusinessException_SetsCorrectStatusAndCode()
    {
        var ex = new BusinessException("BUDGET_NOT_FOUND", "Budget not found", 404);
        var context = MakeContext(ex);

        _sut.OnException(context);

        context.ExceptionHandled.Should().BeTrue();
        var result = context.Result.Should().BeOfType<JsonResult>().Subject;
        result.StatusCode.Should().Be(404);

        var response = result.Value.Should().BeOfType<ErrorResponse>().Subject;
        response.Code.Should().Be("BUDGET_NOT_FOUND");
        response.StatusCode.Should().Be(404);
        response.Success.Should().BeFalse();
        response.Error.Should().Be("BusinessException");
    }

    [Fact]
    public void OnException_BusinessException400_ReturnsBadRequest()
    {
        var ex = BusinessException.BadRequest("VALIDATION_FAILED", "Invalid data");
        var context = MakeContext(ex);

        _sut.OnException(context);

        var result = (JsonResult)context.Result!;
        result.StatusCode.Should().Be(400);
        ((ErrorResponse)result.Value!).Code.Should().Be("VALIDATION_FAILED");
    }

    [Fact]
    public void OnException_BusinessException409_ReturnsConflict()
    {
        var ex = BusinessException.Conflict("BUDGET_ALREADY_EXISTS", "Duplicate period");
        var context = MakeContext(ex);

        _sut.OnException(context);

        var result = (JsonResult)context.Result!;
        result.StatusCode.Should().Be(409);
    }

    // --- ValidationException ---

    [Fact]
    public void OnException_ValidationException_Returns422WithDetails()
    {
        var failures = new List<ValidationFailure>
        {
            new("Month", "Month must be between 1 and 12"),
            new("Year", "Year is required")
        };
        var ex = new ValidationException(failures);
        var context = MakeContext(ex);

        _sut.OnException(context);

        var result = (JsonResult)context.Result!;
        result.StatusCode.Should().Be(422);

        var response = (ErrorResponse)result.Value!;
        response.Error.Should().Be("ValidationException");
        response.Code.Should().Be(ErrorCodes.ValidationFailed);
    }

    // --- Generic exception ---

    [Fact]
    public void OnException_UnknownException_Returns500()
    {
        var ex = new InvalidOperationException("Something went wrong");
        var context = MakeContext(ex);

        _sut.OnException(context);

        var result = (JsonResult)context.Result!;
        result.StatusCode.Should().Be(500);

        var response = (ErrorResponse)result.Value!;
        response.StatusCode.Should().Be(500);
        response.Success.Should().BeFalse();
        // In production mode, message is generic
        response.Message.Should().Be("An unexpected error occurred");
    }

    [Fact]
    public void OnException_UnknownException_DevelopmentMode_ExposesMessage()
    {
        _env.EnvironmentName.Returns("Development");
        var devFilter = new GlobalExceptionFilter(NullLogger<GlobalExceptionFilter>.Instance, _env);
        var ex = new InvalidOperationException("Detailed error message");
        var context = MakeContext(ex);

        devFilter.OnException(context);

        var result = (JsonResult)context.Result!;
        ((ErrorResponse)result.Value!).Message.Should().Be("Detailed error message");
    }

    // --- ExceptionHandled flag ---

    [Fact]
    public void OnException_AlwaysSetsExceptionHandled()
    {
        var context = MakeContext(new Exception("any"));
        _sut.OnException(context);
        context.ExceptionHandled.Should().BeTrue();
    }
}
