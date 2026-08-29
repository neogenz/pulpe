# 0017 — Server-driven minimum-version gate

**Status:** Accepted
**Date:** 2026-05-14
**Recorded:** 2026-08-12 (retrospective)
**Deciders:** Pulpe team

## Context

Security fixes, corrupting client bugs, or breaking API changes may require retiring an old
web or mobile build. A client-bundled policy cannot react after release, while blocking on an
unreachable version service could lock every user out during an outage.

## Decision

Expose a public backend contract with the minimum supported version per platform. Clients
check it at startup and foreground, blocking only after the backend confirms that their
version is below the floor.

- An initial network failure is fail-open; a later failure must not clear a previously
  confirmed hard block.
- Raise a minimum only for a security, compatibility, or data-integrity requirement.
- For store-distributed apps, never serve a minimum above the version users can actually
  download. Rollback lowers the server-side floor.

## Consequences

- Operations can retire unsafe clients without shipping another client release.
- Availability failures do not brick users who have no confirmed block.
- The public endpoint, deployment variables, client comparison, and store lookup form one
  cross-platform contract and must evolve together.

## Alternatives considered

Always accepting old clients was rejected for emergency compatibility and security events.
Fail-closed checks were rejected because a backend outage would become a total client outage.

## References

- `docs/VERSIONING.md`
- `backend-nest/src/modules/app-version/`
- `frontend/projects/webapp/src/app/core/app-version/`
- `ios/Pulpe/Domain/Store/AppVersionStore.swift`
- `android/src/core/system/system-store.ts`, which applies the same rule: fail open on the
  first check, then never lower a gate a later failure cannot re-confirm
