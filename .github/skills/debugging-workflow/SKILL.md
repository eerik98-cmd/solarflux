---
name: debugging-workflow
description: 'Systematic debugging workflow for reproducing bugs, isolating root causes, implementing minimal fixes, and validating behavior in this SolarFlux workspace. Use when investigating runtime errors, broken UI flows, failing tests, regressions, build issues, or unexpected data behavior.'
argument-hint: 'Describe the bug, failing behavior, or error and include reproduction details if known'
user-invocable: true
---

# Debugging Workflow

## When to Use

- Investigating a reproducible bug or regression
- Tracing runtime, build, lint, or type errors
- Narrowing down incorrect UI, state, API, or database behavior
- Fixing a failure without making unrelated changes

## Goals

- Reproduce the problem before changing code
- Isolate the root cause instead of patching symptoms
- Make the smallest defensible fix consistent with the existing codebase
- Validate the fix with the most relevant checks available

## Procedure

1. Define the failure precisely.
   - Restate the observed behavior, expected behavior, scope, and impact.
   - Capture exact error text, route, component, API, or command involved.
   - If reproduction details are missing, ask only for the minimum missing inputs.

2. Reproduce before editing.
   - Inspect the relevant files and recent call paths before proposing changes.
   - Run the narrowest useful validation first, such as a targeted test, lint check, build step, or local reproduction command.
   - If the issue cannot be reproduced, collect stronger evidence before changing code.

3. Map the failure surface.
   - Identify where the behavior is introduced: route, component, context, server action, API handler, service, or utility.
   - Trace data flow in both directions: inputs into the failing path and outputs or side effects produced.
   - Prefer precise workspace searches over broad guesses.

4. Form and rank hypotheses.
   - List the most plausible root causes.
   - Prefer explanations that fit the observed symptom, recent changes, and architecture.
   - Eliminate hypotheses with quick checks instead of debating them abstractly.

5. Implement the smallest root-cause fix.
   - Preserve existing style, APIs, and behavior outside the failing path.
   - Avoid refactors unless they are required to fix the issue safely.
   - Update nearby documentation only if the fix changes developer-facing behavior.

6. Validate at the right level.
   - Re-run the reproduction path that failed originally.
   - Run the narrowest relevant verification, then widen only as needed.
   - Do not assume new automated tests are required unless the user asks for them or the change would otherwise be unsafe to validate.
   - For this repository, prefer commands such as `npm run lint`, `npm run build`, or targeted tests when they directly cover the change.

7. Report outcome and residual risk.
   - State the root cause and why the fix addresses it.
   - Mention what was validated and what could not be validated.
   - Call out any remaining edge cases, assumptions, or follow-up work.

## Decision Rules

- If the bug is not reproducible, prioritize evidence gathering over speculative code edits.
- If multiple layers could be responsible, inspect the narrowest layer with direct ownership of the symptom first.
- If a workaround hides the symptom but leaves invalid state or control flow, do not stop there.
- If the fix introduces broader behavioral risk, add or run stronger verification before concluding.

## Repo-Specific Checks

- App framework: Next.js App Router with TypeScript and Tailwind CSS
- Common surfaces: `app/`, `components/`, `contexts/`, `actions/`, `api/`, `lib/`, `services/`
- Default validation options: `npm run lint`, `npm run build`, and focused test execution when available

## Completion Criteria

- The original failure is reproduced or its absence is explained with evidence
- The root cause is identified clearly
- The fix is minimal and targeted
- Relevant validation passes or any unrun checks are disclosed
- The final report states remaining risks or assumptions

## Expected Response Shape

1. Problem statement
2. Reproduction and evidence
3. Root-cause analysis
4. Implemented fix
5. Validation performed
6. Residual risks or open questions