# compat-lint

Lint the browser compatibility of the APIs your code uses.

| Package                                                              | Description                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@compat-lint/eslint-plugin-compat`](packages/eslint-plugin-compat) | ESLint rule that reports APIs your browserslist targets don't support                |
| [`@compat-lint/ast-metadata-inferer`](packages/ast-metadata-inferer) | Browser API metadata the rule is built on, generated from `@mdn/browser-compat-data` |

Forked from [amilajack/eslint-plugin-compat](https://github.com/amilajack/eslint-plugin-compat) and [amilajack/ast-metadata-inferer](https://github.com/amilajack/ast-metadata-inferer).

## Development

```sh
pnpm install
pnpm build
pnpm test
```

## Releasing

Both packages share one version. Add a changeset to every pull request that changes a package (`pnpm changeset`). Merging the "Version Packages" pull request applies them; pushing the matching tag (`v8.0.0`) publishes both packages.
