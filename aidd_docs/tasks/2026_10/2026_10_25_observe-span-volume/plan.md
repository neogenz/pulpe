---
objective: "Reduce Observe event volume without losing application diagnostics, then ship a silent minor release."
status: in-progress
---

# Plan: Reduce Observe span volume

## Overview

| Field      | Value                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Exclude library providers from spans, sample ordinary waterfalls at 25%, and release the next minor without public What's New. |
| **Source** | User request following NestJS Observe's 2026-10-25 usage email.                                                                |

## Phases

| #   | Phase                          | File                       |
| --- | ------------------------------ | -------------------------- |
| 1   | Configure and validate Observe | [phase-1.md](./phase-1.md) |
| 2   | Publish a silent minor release | [phase-2.md](./phase-2.md) |

## Resources

| Source                                    | Verified                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| https://docs.nestjs.com/observability/sdk | `skipInstrumentation` excludes provider instances; dashboard span sampling is separate from SDK trace sampling. |
