# Feature Plan Template

Use this exact structure for every `FEATURE_PLAN_[YYYYMMDD].md` output. All sections are mandatory.

## Template

```markdown
# Feature Plan — [YYYYMMDD]

## 1. Executive Summary

[3-5 sentences. Pulpe's biggest opportunity right now, grounded in the current product state and its users.]

## 2. Current State

### What's Working
- [Feature/area that works well]

### What's Almost There
- [Feature at 80% that needs the last 20%]

### What's Missing
- [Gap in the user journey]

### What's at Risk
- [Area that could degrade or block progress]

[Reference specific roadmap items (R1/R2) and known bugs.]

## 3. Phase 1: Ship This Week

> High impact, low effort. 3-5 features max. The "how is this not already there?" features.
> Must not conflict with R1 in-flight work.

### Feature 1.1: [Name]

- **What it does:** [User-facing description, French vocabulary]
- **Why it matters now:** [Specific pain point or opportunity]
- **What it builds on:** [Existing feature/data/infra]
- **What it doesn't touch:** [Explicit scope boundaries]
- **Implementation context:** [Architecture layers, modules, docs references]
- **Encryption impact:** [None / Flag if touching financial amounts]
- **Platform:** [iOS / Web / Both]

### Feature 1.2: [Name]
[Same structure]

## 4. Phase 2: Ship This Sprint

> More effort, significant value. 4-6 features max.
> Can overlap with R2 planned items but must add clarity on what specifically to build.

### Feature 2.1: [Name]
[Same per-feature structure]

## 5. Phase 3: Ship This Quarter

> Strategic investment. 3-5 features max. Features that create moats around Pulpe's planning-first philosophy.

### Feature 3.1: [Name]
[Same per-feature structure]

## 6. Parking Lot

> Ideas too early or expensive right now. Cross-reference with Ice Box from roadmap.md.

- **[Idea]** — [Why it's parked, when it might become relevant]

## 7. Rejected Ideas

> 3-5 ideas considered and cut, with reasoning.

- **[Idea]** — [Why it was rejected]

## 8. Dependency Map

> What must be built before what. Reference technical constraints (encryption, RLS, store pattern, cache/SWR).

```
[Feature A] --> [Feature B] --> [Feature C]
[Feature D] --> [Feature B]
```

[Explain dependencies and sequencing rationale.]
```

## Rules

1. **All 8 sections mandatory** — never skip one
2. **Phase sizing:** Phase 1 (3-5), Phase 2 (4-6), Phase 3 (3-5), Rejected (3-5)
3. **Per-feature structure:** all 7 fields (what/why/builds-on/doesn't-touch/impl/encryption/platform) required
4. **Language:** French for user-facing terms and vocabulary; English for technical references
5. **Encryption:** always flag features touching `amount`, `target_amount`, `ending_balance`
6. **Cross-reference:** link to roadmap items, business rules (RG-XXX), and decision records (DR-XXX) when relevant
7. **No code:** implementation context is for planning, not coding
