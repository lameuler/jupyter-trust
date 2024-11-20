# `jupyter-trust`

[![CI](https://github.com/lameuler/jupyter-trust/actions/workflows/ci.yml/badge.svg)](https://github.com/lameuler/jupyter-trust/actions/workflows/ci.yml)

<!---
[![npm version](https://img.shields.io/npm/v/{PACKAGE})](https://www.npmjs.com/package/{PACKAGE})
-->

A utility for managing Jupyter Notebook trust in Node.js.

## Code

All source files are located in the src folder.

```
src/
├── index.ts
└── ...
```

Code formatting is done with [Prettier](https://prettier.io) and can be configured with the [.prettierrc](./.prettierrc) and [.prettierignore](./.prettierignore) files.

```sh
npm run format
```

## Build

```sh
npm run build
```

Building is done by [`tsup`](https://tsup.egoist.dev) and [`tsc`](https://www.typescriptlang.org/docs/handbook/compiler-options.html) and will create 3 folders.

```
dist/
├── cjs/
│   ├── index.js
│   ├── ...
│   └── package.json
├── esm/
│   ├── index.js
│   ├── ...
│   └── package.json
└── types/
    ├── index.d.ts
    └── ...
```

## Test

```sh
npm run lint
npm run format:check
npm test
npm run coverage # run testing with coverage
```

Tests are defined in the test folder and run with [`vitest`](https://vitest.dev), which can be configured in the [vitest.config.ts](./vitest.config.ts) file.

Linting is done by [typescript-eslint](https://typescript-eslint.io) and can be configured in the [eslint.config.mjs](./eslint.config.mjs) file.

The testing is run automatically in the [ci.yml workflow](./.github/workflows/ci.yml) on Linux, Windows, and macOS on Node 18, 20, and 22.

## Release

```sh
npx changeset
```

Versioning and releasing are handled with [changesets](https://github.com/changesets/changesets).
