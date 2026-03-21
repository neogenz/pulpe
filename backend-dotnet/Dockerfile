FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Pulpe.slnx .
COPY src/Pulpe.Api/Pulpe.Api.csproj src/Pulpe.Api/
COPY tests/Pulpe.Api.Tests/Pulpe.Api.Tests.csproj tests/Pulpe.Api.Tests/
RUN dotnet restore

COPY . .
RUN dotnet publish src/Pulpe.Api -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

ENTRYPOINT ["dotnet", "Pulpe.Api.dll"]
