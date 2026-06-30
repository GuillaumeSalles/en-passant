# Agent Notes

This app is on Solid v2 beta. Prefer the Solid v2 API surface that TypeScript
exports, not runtime compatibility shims.

## Solid v2 Guidelines

- Use `createEffect(source, effect)`; single-argument effects are invalid.
- Use `omit` for prop forwarding. `splitProps` may exist at runtime as a
  compatibility shim, but it is not part of the typed v2 surface here.
- Use `onSettled` for mount-style work. `onMount` may exist at runtime, but it
  is not exported by the current type declarations.
- Avoid reading reactive values inside effect callbacks. Put them in the
  effect source, a memo, JSX, or use `untrack` for imperative snapshots.
- Keep list inputs for `<For>` in typed memos when they are derived from
  accessors.
- Do not use `any`. Prefer generics, `unknown`, or explicit tuple inference.

## State And Mutation Guidelines

- Keep mutations explicit and small. A mutation should read like a command:
  select a move, add a NAG, delete a move, replace a chapter PGN.
- Prefer selectors over ad hoc component reads when behavior matters. Selectors
  keep app logic testable without rendering Solid components.
- Keep chess rules, PGN parsing, move tree mutation, NAG handling, and
  serialization testable outside the UI.
- Side effects should be explicit mutation results or context operations, not
  hidden reactive watchers. For example, move sounds are returned as mutation
  effects and played by `useMutation`.
- Do not call browser APIs such as `Audio`, navigation, or storage directly from
  core state helpers unless the function already receives an explicit context
  for that side effect.
- Every mutation must be safe if the PGN, chapter, or move id is missing. Imports,
  deletes, chapter switches, and variation promotion can invalidate assumptions.

## Performance Guidelines

- Avoid broad reactive dependencies like the whole PGN when only a move id,
  chapter id, or small selector result should trigger work.
- For large move lists, prefer stable ids, keyed `<For>` usage, memos, and narrow
  selectors over rebuilding large structures in components.
- Keep board rendering surfaces independent where practical: squares, pieces,
  highlights, arrows, and annotations should not force each other to churn.
- Be careful with selectors that return fresh arrays or objects. If downstream
  updates matter, memoize the derived shape or narrow the selected data.
- Do not add abstractions for possible future performance. Add them when they
  remove real duplication, isolate a real boundary, or make reactivity simpler.

## Stability Guidelines

- Treat flaky tests as bugs. When a test fails intermittently, prioritize
  understanding and fixing the root cause instead of dismissing it, loosening
  assertions, or rerunning until it passes. If the flake is unrelated to the
  current change, still call it out clearly and stabilize it when feasible.
- Add a regression test for every bug class you fix. Prefer unit tests for pure
  state/PGN/chess behavior and e2e tests for event ordering, focus, context
  menus, keyboard shortcuts, board interactions, and console warnings.
- When changing selection behavior, test main line selection, variation
  selection, keyboard navigation, chapter switching, and training mode.
- When changing PGN behavior, test parse and serialize together.
- When touching `MovesTree`, assume Solid tracking bugs are possible. Verify
  clicks, keyboard variation selection, context menus, and selected styling.
- When touching side effects, verify that nearby state edits do not replay the
  effect. NAG/comment/eval updates should not trigger move-only effects.

## Test Commands

- Full local check: `npm run check`
- Format: `npm run format`
- Format check: `npm run format:check`
- Lint: `npm run lint`
- Filename conventions: `npm run check:filenames`
- Code guardrails: `npm run check:guardrails`
- Type-check: `npm run type-check`
- Unit tests: `npm test -- --run`
- Production build: `npm run build`
- E2E tests: `npm run test:e2e`
- Headed E2E: `npm run test:e2e -- --headed`
- Playwright UI mode: `npm run test:e2e -- --ui`

`npm run check` runs format check, Oxlint, filename conventions, custom code
guardrails, TypeScript, unit tests, production build, and Playwright e2e tests.
Run it before handing off broad refactors.

The Playwright config starts its own Vite server on `127.0.0.1:5174` with
`--force` so tests do not depend on a developer's already-running server.

For auth/storage work, use `npm run test:e2e -- tests/e2e/auth.spec.ts` while
iterating, then run the broader relevant suite and `npm run check` before
handoff.

## E2E Isolation Rules

- Use shared helpers from `tests/e2e/helpers.ts` for console collection, auth
  mocks, IndexedDB seeding, and stored-data reads.
- Non-auth specs must mock auth/session endpoints instead of calling the real
  Better Auth routes. This avoids rate limits and keeps console-error
  assertions meaningful.
- Seed IndexedDB from a stable same-origin static asset such as
  `/stockfish-17-lite-single.js`; avoid `/favicon.ico` because it can abort as a
  navigation target.
- Wait for user-ready controls, not just rendered DOM. For repertoire pages,
  prefer helpers such as `expectRepertoireReady(page)` that verify the board,
  moves tree, and enabled navigation controls.

## Agent Workflow

- Use focused tests while iterating, then run `npm run check` before handing off
  substantive work.
- If a flaky or nondeterministic test appears while working, treat it as a
  first-priority stability bug: reproduce it, identify the race/isolation issue,
  and fix the test or app behavior so the suite runs consistently.
- If an expected local testing or tooling capability is unavailable, such as
  `npm`, Playwright browsers, a dev server port, filesystem access, or network
  access that should normally work for this project, pause and ask the user to
  help resolve the environment or permission issue. Do not spend time building
  workaround paths unless the user explicitly chooses that route.
- Keep commits scoped to one conceptual change.
- If touching `src/lib/AppState.ts`, expect broad blast radius and add or update
  tests.
- Do not refactor adjacent code unless it directly reduces risk or makes the
  requested change simpler.
- Prefer boring, explicit helpers over clever generic machinery. This codebase
  is easier to keep stable when control flow is obvious.

## Formatting And Linting

- Oxfmt is the formatter. Do not hand-format around it; run `npm run format`.
- Oxlint is enforced with `--deny-warnings`. Keep new warnings at zero.
- Custom guardrails forbid `any`, `@ts-ignore`, unexplained
  `@ts-expect-error`, `as unknown as`, production non-null assertions, and
  core `src/lib` imports from app/component/mutation layers.
- `no-unassigned-vars` is currently allowed because Solid ref assignment
  patterns produce false positives in a few UI primitives.
- The pre-commit hook runs the formatter and stages fixed files.
- The currently enabled extra TypeScript strictness includes
  `noFallthroughCasesInSwitch`, `noImplicitOverride`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noUnusedLocals`, and `noUnusedParameters`.

## Filename Conventions

- Top-level component files under `src/components` use PascalCase.
- Hook files use `useSomething.ts`.
- UI primitives under `src/components/ui` may be lowercase/kebab-case to match
  the primitive naming style, or PascalCase for existing composed UI pieces.
- Helper/service files such as `src/components/engine.ts` and chessboard helper
  files stay lowercase.
- Run `npm run check:filenames` after moving or adding component files.

## E2E Expectations

The e2e spec seeds IndexedDB directly, opens
`/repertoires/untitled-repertoire/chapter-1`, verifies the board/sidebar/settings
UI, and fails on fresh console warnings/errors. Keep this as a safety net before
larger Solid refactors.

## Dependency Notes

Installing Playwright required `--legacy-peer-deps` because the Solid router beta
currently creates an npm peer-resolution conflict with the testing library.
