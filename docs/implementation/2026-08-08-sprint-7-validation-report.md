# Sprint 7 — RC1 Polish & Demo Experience

## Validation report

Date: 2026-08-08
Branch: `feature/sprint-7-rc1-polish`
Status: `MERGE_READY`

## Scope validated

Sprint 7 completes the RC1 polish and demo experience without introducing a new architecture or external provider dependencies. The validated scope includes:

- RC1 release metadata and visible versioning.
- Step 6 orientation layer with four areas: Generate, History, Export and Review.
- Demo Mode with synthetic, local, reversible, profile-isolated data.
- Demo flow through Photos, Identity Evidence, Identity Lock, Creative Direction, Validation/Readiness, Prompt generation, History, Export and cleanup.
- Runtime correction for `ProfileDirection.markReady()` so the explicit READY transition is preserved.
- Sprint 2 runner hardening with durable persistence barriers and deterministic HTTP execution.

## Sprint 7 gate

The Sprint 7 runtime gate passed twice consecutively:

- Run 1: `SPRINT_7_READY`
- Run 2: `SPRINT_7_READY`

The successful flow reached `STEP=complete` with `TEST_STATUS=passed`.

## Regression results

Final regression evidence:

- Sprint 0: 20/20 PASS
- Sprint 1: 31/31 PASS
- Sprint 2 canonical deterministic runner: PASS (`SPRINT_2_READY`)
- Sprint 2 stability gate: 20/20 PASS
- Sprint 3: 19/19 PASS
- Sprint 4: 42/42 PASS
- Sprint 5: 66/66 PASS
- Sprint 6: 66/66 PASS
- Sprint 7: `SPRINT_7_READY`

`git diff --check` completed without reported errors before final commit and the working tree was clean after the validated Sprint 7 commit.

## Defects found and resolved during Sprint 7

### Direction READY transition

Root cause: `ProfileDirection.markReady()` assigned `READY` and then called `markUpdated()`. The latter intentionally invalidates an already-ready direction back to `DRAFT` when creative content changes, so the explicit transition invalidated itself.

Resolution: update timestamps first and set the final READY status afterwards. This preserves normal invalidation semantics for subsequent direction edits.

### Sprint 2 persistence flakiness

The legacy Sprint 2 harness used `file://` plus Chrome virtual-time budgeting and could reload while storage writes were still pending. That produced non-deterministic reload results and occasional `TEST_STATUS=running` outcomes.

Resolution:

- add explicit `ProfileStorage.flush()` durability barriers before reloads;
- run the stability gate through an isolated local HTTP harness with real time and a clean browser profile per run;
- make the canonical Sprint 2 runner delegate to the deterministic HTTP harness.

A 20-run stability gate completed 20/20 PASS, and the canonical Sprint 2 runner subsequently completed with `SPRINT_2_READY`.

## Release decision

`MERGE_READY`

No open P0/P1 runtime blocker remains in the validated Sprint 7 scope. The branch is ready for a final pull request to `main`.
