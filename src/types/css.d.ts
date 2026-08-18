// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// TypeScript 6.0 tightened side-effect import checking (noUncheckedSideEffectImports),
// so untyped CSS imports such as `import '@/styles/globals.css'` in pages/_app.tsx now
// require an ambient module declaration. This shim restores the pre-6.0 behavior for all
// CSS imports.
//
// Without it, `tsc --noEmit` only passes when a previous `next build` has left a
// gitignored next-env.d.ts in the tree — so it passed locally and failed on a fresh CI
// checkout. Matches src/types/css.d.ts in MyScrumBudget, added there for the same reason
// at its own TypeScript 6.0.3 bump.
declare module '*.css';
