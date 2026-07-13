# Integration

## External services
- Supabase provides Auth, PostgreSQL/RLS, and RPCs; Frankfurter provides cached CHF/EUR rates with stale fallback.
- Turnstile protects demo creation; PostHog handles analytics/error tracking and optional account-deletion cleanup.
- Identity providers are detailed in [auth.md](auth.md); clients reach them through Supabase, not the Nest backend.

```mermaid
---
title: External integrations
---
flowchart LR
    Clients["Web and iOS"]; Api["Nest API"]; Auth["Supabase Auth and OAuth"]; Db["Supabase PostgreSQL"]; Fx["Frankfurter"]; Bot["Turnstile"]; Analytics["PostHog"]
    Clients --> Auth; Clients --> Api; Clients --> Analytics; Api --> Db; Api --> Fx; Api -. demo verification .-> Bot; Api -. deletion cleanup .-> Analytics
```
