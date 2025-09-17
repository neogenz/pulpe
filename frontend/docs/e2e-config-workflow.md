# 🎭 E2E Configuration Workflow

## Architecture Overview

```mermaid
flowchart TD
    A[🎭 pnpm test:e2e] --> B[📄 playwright.config.ts]
    B --> C[🚀 webServer.command<br/>DOTENV_CONFIG_PATH=.env.e2e]

    C --> D[📦 pnpm run start:ci]
    D --> E[⚙️ npm run generate:config]
    E --> F[🔨 tsx scripts/generate-config.ts]

    F --> G[📋 Read process.env.DOTENV_CONFIG_PATH]
    G --> H[🔧 config({ path: envPath })]
    H --> I[🔍 EnvSchema.parse]
    I --> J{✅ Valid?}
    J -->|❌ No| K[💥 Exit with Error]
    J -->|✅ Yes| L[🔄 envToConfig]

    L --> M[🔍 ConfigSchema.parse]
    M --> N{✅ Valid?}
    N -->|❌ No| K
    N -->|✅ Yes| O[📄 Write config.json]

    O --> P[🏗️ ng serve]
    P --> Q[🌐 Angular App Start]

    Q --> R[📡 HTTP GET /config.json]
    R --> S[🔍 ConfigSchema.parse]
    S --> T{✅ Valid?}
    T -->|❌ No| U[⚠️ Fallback Config]
    T -->|✅ Yes| V[✅ Apply Configuration]

    V --> W[🧪 E2E Tests Execute]

    style A fill:#e1f5fe
    style G fill:#fff3e0
    style I fill:#f3e5f5
    style M fill:#f3e5f5
    style S fill:#f3e5f5
    style W fill:#e8f5e8
```

## Data Flow Detail

```mermaid
flowchart LR
    subgraph "📁 Input Files"
        A1[.env.e2e<br/>Flat strings]
    end

    subgraph "🔍 Build-time Validation"
        B1[EnvSchema<br/>String validation]
        B2[envToConfig<br/>Transform]
        B3[ConfigSchema<br/>Structure validation]
    end

    subgraph "📄 Generated File"
        C1[config.json<br/>Nested JSON]
    end

    subgraph "🔍 Runtime Validation"
        D1[HTTP GET]
        D2[ConfigSchema<br/>Integrity check]
    end

    subgraph "🎯 Angular App"
        E1[Signals Updated<br/>App Ready]
    end

    A1 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> C1
    C1 --> D1
    D1 --> D2
    D2 --> E1

    style B1 fill:#ffebee
    style B3 fill:#ffebee
    style D2 fill:#ffebee
```

## Validation Layers

```mermaid
graph TD
    subgraph "🔒 Triple Validation System"
        A[🔍 EnvSchema<br/>Build-time<br/>String → Types]
        B[🔍 ConfigSchema<br/>Build-time<br/>Structure Check]
        C[🔍 ConfigSchema<br/>Runtime<br/>Integrity Protection]
    end

    D[📁 .env.e2e] --> A
    A --> E[✨ Type Transformation]
    E --> B
    B --> F[📄 config.json]
    F --> G[🌐 HTTP Load]
    G --> C
    C --> H[✅ Angular App]

    style A fill:#e3f2fd
    style B fill:#e8f5e8
    style C fill:#fff3e0
```

## Environment Configuration

```mermaid
flowchart TD
    subgraph "🔧 Environment Variables (.env.e2e)"
        A1[PUBLIC_ENVIRONMENT=test]
        A2[PUBLIC_POSTHOG_ENABLED=false]
        A3[PUBLIC_SUPABASE_URL=localhost:54321]
        A4[PUBLIC_BACKEND_API_URL=localhost:3000]
        A5[... 13 variables total]
    end

    subgraph "🎯 Final Configuration (config.json)"
        B1[environment: 'test']
        B2[postHog.enabled: false]
        B3[supabase.url: 'localhost:54321']
        B4[backend.apiUrl: 'localhost:3000']
    end

    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
    A5 --> B4

    style A1 fill:#fff3e0
    style A2 fill:#fff3e0
    style A3 fill:#fff3e0
    style A4 fill:#fff3e0
    style B1 fill:#e8f5e8
    style B2 fill:#e8f5e8
    style B3 fill:#e8f5e8
    style B4 fill:#e8f5e8
```

## Error Handling Flow

```mermaid
flowchart TD
    A[🔍 Validation Step] --> B{✅ Valid?}
    B -->|✅ Yes| C[Continue to Next Step]
    B -->|❌ No| D[📝 formatConfigError]
    D --> E[💬 User-friendly Message]
    E --> F[💡 Helpful Suggestions]
    F --> G[🚨 Exit Process]

    G --> H[💭 Common Fixes]
    H --> I[Check .env.e2e file]
    H --> J[Verify all variables present]
    H --> K[Check variable formats]

    style B fill:#fff3e0
    style G fill:#ffebee
    style H fill:#e3f2fd
```

## Key Benefits

```mermaid
mindmap
  root((🎯 Zod Schema<br/>Benefits))
    🔒 Security
      Triple validation
      Type safety
      Runtime protection
    🧹 Maintainability
      Single source of truth
      Auto documentation
      Consistent errors
    🚀 Performance
      Build-time validation
      Fast tsx execution
      Efficient transforms
    🧪 Testing
      Isolated config
      E2E safety
      Mock-friendly
```

## File Structure

```mermaid
graph TD
    subgraph "📁 Frontend Project"
        A[scripts/generate-config.ts]
        B[projects/webapp/src/app/core/config/config.schema.ts]
        C[projects/webapp/src/app/core/config/application-configuration.ts]
        D[projects/webapp/public/config.json]
        E[.env.e2e]
        F[playwright.config.ts]
    end

    E --> A
    B --> A
    A --> D
    D --> C
    F --> A

    style A fill:#fff3e0
    style B fill:#e3f2fd
    style C fill:#e8f5e8
    style D fill:#f3e5f5
```

---

## Summary

This workflow ensures **type-safe**, **validated**, and **isolated** configuration for E2E tests using:

- 🎭 **Playwright** orchestration
- 🔍 **Zod** validation (3 layers)
- ⚡ **tsx** TypeScript execution
- 🔒 **Triple validation** (env → structure → runtime)
- 🧪 **Test isolation** with dedicated `.env.e2e`

The system is **robust**, **maintainable**, and provides **excellent developer experience** with clear error messages and type safety throughout! 🎉