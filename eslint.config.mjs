// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import nextConfig from 'eslint-config-next/core-web-vitals';
import sonarjs from 'eslint-plugin-sonarjs';

const config = [
  { ignores: ['.claude/**'] },
  // Cognitive complexity only — NOT sonarjs.configs.recommended. The plugin is here to
  // answer "where is this code hard to change safely?". Threshold 15 matches
  // spert-scheduler, spert-forecaster and MyScrumBudget.
  //
  // files: scopes this to TS/TSX by construction, so scripts/*.mjs falls outside it.
  // scripts/shipgate.mjs is byte-identical across nine repos and a plugin-specific
  // directive in it once broke CI in six siblings at once.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { sonarjs },
    rules: { 'sonarjs/cognitive-complexity': ['error', 15] },
  },
  ...nextConfig,
  { ignores: ['.next/*', 'coverage/**', '**/*-old.*', '**/*.backup'] },
];

export default config;
