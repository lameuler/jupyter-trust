# `typescript-package`

<!--- (uncomment to use badges)
[![CI](https://github.com/{USERNAME}/{REPO}/actions/workflows/ci.yml/badge.svg)](https://github.com/{USERNAME}/{REPO}/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/{PACKAGE})](https://www.npmjs.com/package/{PACKAGE})
-->

This is a template repository for creating a typescript package that builds to both CommonJS and ESM.

Click on "[Use this template](https://github.com/new?template_name=typescript-package&template_owner=lameuler)" to get started. Then set the package name in [package.json](./package.json) and run `npm install`.

You can also link the package to the git repository in [package.json](./package.json).
You should also update the [LICENSE](./LICENSE) file (and the license field in [package.json](./package.json) if you're not using an [MIT License](https://choosealicense.com/licenses/mit/)).

```json
{
    "repository": {
        "type": "git",
        "url": "git+https://github.com/{USERNAME}/{REPO}.git"
    },
    "license": "MIT"
}
```

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

Before the release workflow can work, you will need to set the repository name in [.changeset/config.json](./.changeset/config.json) and the repository owner in the [release.yml workflow](./.github/workflows/release.yml). You will also need to create an `NPM_AUTH_TOKEN` [repository secret](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository).

When you're ready to publish the package, remove `"private": true` from [package.json](./package.json).
