# Changesets

Every pull request that changes a package adds a changeset:

```sh
pnpm changeset
```

Both packages share one version (`fixed` in `config.json`). Merging the "Version Packages" pull request applies the pending changesets; pushing the matching `v*` tag publishes both packages.
