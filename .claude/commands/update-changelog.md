As Product Owner of this project, compare changes between the current branch and main branch to update the changelog, following this workflow:

## 1. Extract and categorize changes

Generate a clear, business-oriented list of changes from the branch comparison.

**Skip changeset creation if the branch contains only technical changes:**

- Internal refactoring or code reorganization
- Performance optimizations without user-facing impact
- Development dependency updates
- CI/CD pipeline changes
- Documentation updates (internal comments, README)
- Test additions or modifications
- Code style or formatting changes

## 2. Create changeset

Run `pnpm changeset` and for each change:

- Select appropriate packages to release
- Choose semantic version bump type:
  - **MAJOR**: Breaking changes that affect the public API
  - **MINOR**: New features or enhancements (backward compatible)
  - **PATCH**: Bug fixes (backward compatible)
- Write clear, user-focused descriptions explaining the business impact

## 3. Validation loop

Present the proposed changelog to the user with:

- List of affected packages and their version bumps
- Summary of changes with business impact descriptions
- Ask for explicit validation: "Does this changelog accurately reflect the changes? (yes/no)"
- Iterate until user explicitly approves with "yes" or equivalent confirmation

## 4. Apply versions

Once validated, run `pnpm changeset version` to:

- Bump package versions according to the changesets
- Update CHANGELOG.md files
- Handle internal package dependencies automatically

## Guidelines

- Prioritize user-facing impact over technical implementation details
- Use clear, non-technical language in changeset descriptions
- When in doubt about version bump level, prefer the more conservative (higher) option
- Ensure each changeset focuses on a single logical change or feature
