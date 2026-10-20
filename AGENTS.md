# Agent Notes

This is the GPL frontend for En Passant. It uses Solid v2 RC and deploys to
Cloudflare Pages project `enpassant`.

## Non-Negotiables

- The app is local-only. Do not add authentication, backend calls, or automatic
  imports/migrations. Production backups are imported only through an explicit user action.
- This repository contains only the browser app. Persist through IndexedDB.
  Native clients and SQLite support are deferred; do not reintroduce them.
- Never delete or reset a library to recover from an error. Report the failure and
  preserve the original data. Keep database schema versions explicit.
- Do not import closed-source backend code into this GPL repository.
- Do not use `any`; prefer generics, `unknown`, or explicit tuple inference.
- Keep chess rules, PGN parsing, move tree mutation, NAG handling, and
  serialization testable outside UI components.
- Mutations must be safe when PGN, chapter, or move ids are missing; imports,
  deletes, chapter switches, and variation promotion can invalidate assumptions.
- Treat flaky tests as bugs. Understand and fix the race/isolation issue instead
  of loosening assertions or rerunning until green.

## Solid v2

- Use `createEffect(source, effect)`, not single-argument effects.
- Use `omit` for prop forwarding; `splitProps` is not part of the typed v2
  surface here.
- Use `onSettled` for mount-style work; `onMount` is not exported by current
  type declarations.
- Avoid reading reactive values inside effect callbacks. Put them in the source,
  a memo, JSX, or use `untrack` for imperative snapshots.
- Keep derived `<For>` inputs in typed memos.

## State And Performance

- Keep mutations explicit and command-like: select a move, add a NAG, delete a
  move, replace a chapter PGN.
- Prefer selectors over ad hoc component reads when behavior matters.
- Side effects should be explicit mutation results or context operations, not
  hidden reactive watchers.
- Avoid broad reactive dependencies like the whole PGN when a move id, chapter
  id, or small selector result is enough.
- For large move lists, use stable ids, keyed `<For>`, memos, and narrow
  selectors.
- Keep board rendering surfaces independent where practical: squares, pieces,
  highlights, arrows, and annotations should not force each other to churn.
- Add abstractions only when they remove real duplication, isolate a real
  boundary, or simplify reactivity.

## Local Storage Boundary

- New stores use `en-passant-local-v1` names and never read legacy account-linked stores.
- Persist complete PGNs and training schedules in atomic transactions. Await durable
  writes and report failures; never claim a failed save succeeded.
- IndexedDB commits check an expected revision and write related records in one
  transaction. Do not silently overwrite unrelated concurrent edits.
- Future encrypted sync must remain an optional adapter; it must not become the
  source of truth or a prerequisite for editing and training.

## Tests And Checks

- Full check: `npm run check`
- Format: `npm run format`
- Format check: `npm run format:check`
- Lint: `npm run lint`
- Filename conventions: `npm run check:filenames`
- Code guardrails: `npm run check:guardrails`
- Type-check: `npm run type-check`
- Unit tests: `npm test -- --run`
- Build: `npm run build`
- E2E: `npm run test:e2e`
- Headed E2E: `npm run test:e2e -- --headed`
- Playwright UI: `npm run test:e2e -- --ui`

`npm run check` runs format check, Oxlint, filename checks, guardrails,
TypeScript, unit tests, production build, and Playwright e2e. Use focused tests
while iterating, then run the relevant broader suite before handoff.

Add a regression test for every bug class you fix. Prefer unit tests for pure
state/PGN/chess behavior and e2e tests for event ordering, focus, context menus,
keyboard shortcuts, board interactions, and console warnings.

Selection changes should cover main line selection, variation selection,
keyboard navigation, chapter switching, and training mode. PGN changes should
test parse and serialize together. When touching `MovesTree`, verify clicks,
keyboard variation selection, context menus, and selected styling. When touching
side effects, ensure nearby NAG/comment/eval edits do not replay move-only
effects.

## E2E Rules

- Use helpers from `tests/e2e/helpers.ts` for console collection,
  IndexedDB seeding, and stored-data reads.
- Local-only regression specs assert that no `/api/*` requests occur.
- Seed IndexedDB from a stable same-origin static asset such as
  `/stockfish-17-lite-single.js`; avoid `/favicon.ico`.
- Wait for user-ready controls, preferably helpers such as
  `expectRepertoireReady(page)`.
- `npm run test:e2e` allocates an available localhost port and starts Vite with
  `--force` and `reuseExistingServer: false`. Direct Playwright CLI invocations
  default to port 5174; prefer the npm script so unrelated dev servers do not
  block the run.
- For storage work, iterate with
  `npm run test:e2e -- tests/e2e/storage.spec.ts`.
- Do not edit or format app sources while browser tests are running: Vite's live
  reload can invalidate the test's component tree.

## Formatting And Names

- Oxfmt is the formatter; do not hand-format around it.
- TypeScript scripts run through `tsx` use the repository's CommonJS mode. Put
  asynchronous entry-point work in `main()` and call it with `main().catch(...)`
  instead of using top-level `await`.
- Oxlint runs with `--deny-warnings`; keep new warnings at zero.
- Guardrails forbid `any`, `@ts-ignore`, unexplained `@ts-expect-error`,
  `as unknown as`, production non-null assertions, and core `src/lib` imports
  from app/component/mutation layers.
- Top-level component files under `src/components` use PascalCase.
- Hook files use `useSomething.ts`.
- UI primitives under `src/components/ui` may follow the existing primitive
  lowercase/kebab-case style, or PascalCase for composed UI pieces.
- Helper/service files such as `src/components/engine.ts` and chessboard helpers
  stay lowercase.

## Agent Workflow

- Keep commits scoped to one conceptual change.
- Do not refactor adjacent code unless it directly reduces risk or simplifies
  the requested change.
- If touching `src/lib/AppState.ts`, expect broad blast radius and add or update
  tests.
- If expected tooling is unavailable (`npm`, Playwright browsers, dev server
  port, filesystem, network), pause and ask the user instead of building
  workaround paths unless they choose that route.
- Log avoidable friction before pushing through:
  `./papercuts add "<what hurt and what would have prevented it>" --tag <area>`.
  Use `--severity major` for time sinks and `--severity blocker` for hard walls.

## Dependency Notes

The repository enables `legacy-peer-deps` in `.npmrc` for the Solid 2 prerelease
dependency graph.
