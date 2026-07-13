# Navigation

## Routing
- Angular Router uses lazy public/auth and guarded main shells; maintenance, auth, encryption, and budget guards gate access.
- Landing uses Next App Router; iOS uses a three-tab root plus typed stack destinations. Startup lifecycle lives in [mobile.md](mobile.md).

## Structure
```mermaid
---
title: Pulpe navigation
---
flowchart LR
    Landing["Landing"]; Public["Welcome and auth"]; Guarded["Authenticated web shell"]; Dashboard["Dashboard"]; Budgets["Budgets"]; Templates["Templates"]; Settings["Settings"]; Tabs["iOS tabs"]; Home["Home"]; IosBudgets["Budgets"]; IosTemplates["Templates"]
    Landing --> Public; Public --> Guarded; Guarded --> Dashboard; Guarded --> Budgets; Guarded --> Templates; Guarded --> Settings; Tabs --> Home; Tabs --> IosBudgets; Tabs --> IosTemplates
```
