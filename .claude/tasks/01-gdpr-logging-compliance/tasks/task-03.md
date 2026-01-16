# Task: Document GDPR Compliance Guidelines

## Problem

The logging documentation (`LOGGING.md`) doesn't document GDPR compliance requirements. Developers need clear guidelines on what data should never be logged and how anonymization is handled.

## Proposed Solution

Add a GDPR compliance section to `LOGGING.md` that:
1. Explains the automatic anonymization applied to HTTP logs
2. Lists data that should NEVER be logged
3. Updates existing examples to reflect the new behavior

## Dependencies

- Task 1: IP and User-Agent Anonymization (should be completed first so docs reflect actual behavior)
- Task 2: Remove Financial Data (should be completed first)

## Context

- **Target file**: `backend-nest/LOGGING.md`
- **Insert location**: After section "🔒 Sécurité et Redaction" (around line 180)
- **Also update**: "Guard Authentication" section examples (lines 329-340) to note automatic anonymization

## Success Criteria

- New "GDPR Compliance" subsection added
- Documentation explains IP anonymization format
- Documentation explains device type simplification
- List of data that must never be logged (raw IPs, full User-Agents, financial amounts, personal identifiers beyond UUIDs)
- Existing examples updated to reflect changes
- Documentation is consistent with implemented behavior
