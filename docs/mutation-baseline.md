# Mutation baseline — v0.28.6

First mutation-testing run in this repo. **This is a recorded baseline with classified
survivors, not a score target.** No survivor was remediated, no threshold is set, and
`npm run mutate` is deliberately not a ship-gate step.

Command: `npm run mutate` (wraps `npx stryker run`; never call Stryker directly — see
"The guard" below).
Scope: `src/shared/utils/{validation,export,storage}.ts`.
Stryker 9.6.1 · `coverageAnalysis: perTest` · `checkers: ["typescript"]` · no `excludedMutations`.
Run time: **58 min 47 s** wall clock.

## Result

| file | Killed | Timeout | Survived | NoCoverage | CompileError | Ignored | valid | score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `validation.ts` | 337 | 12 | 97 | 26 | 181 | 0 | 472 | 73.94% |
| `export.ts` | 223 | 1 | 91 | 43 | 150 | 0 | 358 | 62.57% |
| `storage.ts` | 38 | 0 | 21 | 4 | 87 | 0 | 63 | 60.32% |
| **total** | **598** | **13** | **209** | **73** | **418** | **0** | **893** | **68.42%** |

`RuntimeError` was 0 everywhere and is omitted from the columns above.

**Arithmetic, so the score can be reconciled rather than trusted:**

```
total mutants     = 598 + 13 + 209 + 73 + 418 + 0 + 0        = 1311
valid denominator = Killed + Timeout + Survived + NoCoverage = 893
score             = (598 + 13) / 893                         = 68.42%
covered score     = (598 + 13) / (893 - 73)                  = 74.51%
```

`Ignored` is listed explicitly because it is easy to omit and it changes the denominator.
It is 0 here — but it was 17 during a deliberate falsification run, which is how that was
verified rather than assumed.

**CompileError is 32% of all mutants (418/1311).** Expected: `tsconfig` is `strict` and 70 of
71 functions in these files carry an explicit return type, so block-emptying and literal
mutators frequently produce type-invalid code. Those are neither killed nor survivors and are
correctly excluded from the denominator.

## Survivor classification — all 209

| file | GAP | EDGE (boundary) | EDGE (regex alt) | EQUIV (absorbed) | EQUIV (log text) | total |
|---|---:|---:|---:|---:|---:|---:|
| `validation.ts` | 63 | 24 | 10 | 0 | 0 | 97 |
| `export.ts` | 46 | 25 | 3 | 16 | 1 | 91 |
| `storage.ts` | 5 | 0 | 0 | 13 | 3 | 21 |
| **total** | **114** | **49** | **13** | **29** | **4** | **209** |

EQUIV is **33 of 209 (15.8%)**. The remaining 176 are real, unfixed observations.
Separately, **73 `NoCoverage` mutants** are NOCOV by definition — code no test reaches.

Classification is by cluster, with each cluster's reason stated below and verified
structurally on a representative member. It is not 209 individual proofs, and it should not
be read as one.

### EQUIV — 33, each with a structural reason

**Absorbed by a re-applied constraint — 29.** In `storage.ts:validateLoadedData` and
`export.ts:parseImportedData`, guards of the form

```ts
if (d.chartColors && typeof d.chartColors === 'object') {
  result.chartColors = sanitizeChartColors(d.chartColors);
}
```

are followed immediately by a sanitiser that **opens with the same constraint** —
`sanitizeChartColors` begins `if (!colors || typeof colors !== 'object')`. Two independent
applications on one data path, so mutating the outer guard cannot change the result. Verified
for `sanitizeChartColors`, `sanitizeLegendLabels`, `sanitizeDisplaySettings` and
`sanitizeExportAttribution`. `storage.ts:28`'s entry guard is absorbed differently but as
structurally: the `Array.isArray(d.projects)` check two lines below returns `null` for
everything it would have caught, and the caller wraps it in `try/catch`.

**Unasserted log text — 4.** `console.error('Error saving data to localStorage:', …)` and
three siblings. Verified by measurement, not assumption: **zero tests reference any of these
four strings**. The message has no observable contract.

⚠️ EQUIV is the flattering bucket — every other category creates work and this one dismisses
it. Both reasons above are structural (a re-applied constraint; an absent contract), not
"the output looked the same". Any future addition to this bucket should meet the same bar.

### GAP — 114

Real gaps. The largest clusters:

- **Type-guard early returns never exercised with the input class they exist for.**
  `sanitizeString`'s `if (typeof str !== 'string') return ''` survives because no test passes a
  non-string. These guards exist for untrusted JSON and localStorage, which is precisely the
  input no test supplies.
- **`sanitizeFirebaseError`'s mapping table** — 8 survivors, one per unexercised `case` label
  (`'unauthenticated'`, `'not-found'`, `'already-exists'`, …). Each is an untested branch of a
  documented user-facing mapping.
- **Whitelist arrays** — `validFontSizes`, `validDateFontSizes`, `validLabelColors`,
  `validLineWidths`, `validBarHeights`, `validRowSpacings`, and the preset-name list. Mutating
  an entry to `""` survives because tests exercise one member, not each.
- **`parseImportedData`'s `typeof … === 'boolean'` field guards** where no test asserts that
  particular field survives the round trip.

### EDGE — 62

- **Boundary comparisons — 49.** `early > late`, `mlMs < earlyMs`, `startDate < '2000-01-01'`,
  `length > MAX_PROJECTS`, `deduped.length > 7`. Off-by-one mutants at limits the tests hit from
  one side only.
- **Regex alternatives — 13.** The hex-colour pattern accepts 3/4/6/8 digits and tests exercise
  3 and 6; the date pattern and the slug helper's `\s+` / `-+` / `^-|-$` replacements are the
  rest.

## The pre-registered EQUIV prediction — held

Registered before the run: *EQUIV survivors will cluster in the re-application paths of
`storage.ts` and `export.ts`, and NOT in `validation.ts`'s sanitiser internals.*

**Held exactly: 29 absorbed-EQUIV — 16 `export.ts`, 13 `storage.ts`, 0 `validation.ts`.**

The mechanism is worth recording because an earlier reading of it was wrong. A call-site count
measures **reuse**, not redundancy on a path: `sanitizeString` has 45 call sites, and a mutant
inside it propagates to all of them at once and cannot be masked by its own reuse. EQUIV needs
**two independent applications of one constraint on one path** — which is what the caller-guard
plus sanitiser-guard pair produces, and what `validation.ts`'s internals, having nothing
downstream of them, cannot.

The same constraint therefore survives in two places for two different reasons: **EQUIV** in
`storage.ts` (absorbed by the duplicate) and **GAP** in `validation.ts` (no test supplies the
input class). Identical code, identical observable, opposite dispositions.

## Reading these numbers

- **Small-denominator rule.** Below roughly 20 valid mutants a score is not evidence. All three
  files clear that (63, 358, 472), so the per-file scores are readable — but an individual
  survivor finding is as valid at n=9 as at n=900, and the GAP list above should be read
  per-item, not through the score.
- `storage.ts`'s 60.32% is the lowest score and the **least** alarming: 16 of its 21 survivors
  are EQUIV. Score alone inverts the ranking here, which is the argument for classifying rather
  than tracking a number.
- No threshold is set. A future comparison run should hold Stryker at 9.6.1 and the same
  `excludedMutations` (none), or the numbers are not comparable.

## Control: `maxTestRunnerReuse`

Measured on `storage.ts`, incremental cache deleted between runs, comparing **per-mutant
verdicts** rather than the score — two offsetting differences would cancel in an aggregate and
leave the score identical while the verdicts had changed.

| | mutants | Killed | Survived | NoCoverage | CompileError | score | wall |
|---|---:|---:|---:|---:|---:|---:|---:|
| default | 150 | 38 | 21 | 4 | 87 | 60.32% | 1m31s |
| `--maxTestRunnerReuse 1` | 150 | 38 | 21 | 4 | 87 | 60.32% | 1m44s |

**Zero per-mutant verdict differences; zero mutants unique to either run.** Matches Forecaster
and MyScrumBudget; does not reproduce Scheduler's 10.07%-vs-84.21% divergence. The setting is
therefore **not** configured here — it costs 14% wall clock and buys no verdict change.

## The guard

`npm run mutate` wraps Stryker in `scripts/mutation-guard.mjs` because **a run that fails to
start emits no survivors and no score, which is indistinguishable from a perfect result.**

⚠️ Never call `npx stryker` directly, and never pass `--reporters` on the CLI: it *replaces* the
configured array including `json`, silently removing the report that the guard and every future
comparison depend on. The report path is hard-coded at `mutation-guard.mjs:31` and configured at
`stryker.config.json`'s `jsonReporter.fileName`; the two have no compile-time link.

All four vacuous-run modes were falsified before any number here was trusted, plus a positive
control:

| mode | how it was provoked | guard's response |
|---|---|---|
| dies before reporting | `--configFile does-not-exist.json` | *no report … treat this as NO RESULT, not as zero survivors* |
| **stale report from an earlier run** | planted a report claiming 2/2 killed, then forced the failure above | report deleted before the run; **zero score lines printed** |
| globs match nothing | `--mutate src/shared/utils/index.ts` (a barrel) | report written with 0 mutants → *the report contains ZERO mutants* |
| runner never exercises the suite | `// Stryker disable all` in the target file | *17 mutants were generated but NONE were executed (Ignored 17)* |
| **positive control** | real scoped run on `auth-name.ts` | 17 mutants, real verdicts, guard passes |

The stale-report mode is the one worth keeping: without the guard's `rmSync`, that planted
report would have been read and reported as a 100% score for a run that never happened.

## Clone-state probe

Stryker's input set is the tsconfig program plus the vitest include, and it *creates*
`.stryker-tmp/` and `reports/`. Gitignored-and-generated members were checked **before** the
baseline run, not after: with `next-env.d.ts` and `.next/` moved aside, `tsc --noEmit` exits 0
and a scoped Stryker run completes normally with the typescript-checker resolving (2
CompileError verdicts — the checker working, not failing). `.next/types/**/*.ts` being listed in
`tsconfig` `include` while absent from a clone does **not** break the checker.

`.stryker-tmp/**` and `reports/**` are excluded in **two** places, not three: `.gitignore` and
`eslint.config.mjs`. The eslint one is not optional now that the complexity ratchet is live —
sandbox copies of mutated files would be linted and blow the accepted baseline of 13. The vitest
config does not need an exclusion here: its include is `src/**/*.test.{ts,tsx}`, anchored at
`src/`, and minimatch returns false for `.stryker-tmp/sandbox-1/src/**`.

## Cost

58m47s for 546 branches across three files, against a per-file estimate of 5–13 min drawn from
another repo. Roughly 4.5× the top of that estimate. The dominant term is 1311 mutants each
type-checked and then run against covering tests. If this is repeated regularly, the levers are
narrowing scope, `excludedMutations` (`StringLiteral` alone accounts for 35 survivors and a
large share of compile errors), or raising `concurrency` above 4.
