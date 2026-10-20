#!/usr/bin/env bash
# Writes a changeset for each dependency that Dependabot updated since the last release of a package,
# as Dependabot pull requests come without changesets.
# Usage: dependabot-changesets.sh
set -euo pipefail

for manifest in packages/*/package.json; do
  package="$(basename "$(dirname "$manifest")")"
  # A release writes the changelog, which lists the updates before it
  released="$(git log -1 --format=%H -- "packages/$package/CHANGELOG.md")"
  [ -n "$released" ] || continue

  # Only dependencies reach users of the package, devDependencies and the lockfile do not
  updated="$(
    git log --full-history --author='^dependabot\[bot\]' --format=%H "$released..HEAD" -- "$manifest" |
      while read -r commit; do
        git show "$commit:$manifest" | jq -r --argjson before "$(git show "$commit^:$manifest")" '
          .dependencies // {} | to_entries[] | select($before.dependencies[.key] != .value) | .key
        '
      done
  )"

  # Lists each dependency once, from the version of the last release to the current one
  jq -r --argjson released "$(git show "$released:$manifest")" --arg updated "$updated" '
    .name as $name
    | ($released.dependencies // {}) as $before
    | (.dependencies // {}) as $after
    | $updated | split("\n") | unique[] | select($before[.] and $after[.] and $before[.] != $after[.])
    | [$name, (ltrimstr("@") | gsub("[^a-z0-9]+"; "-")), ., ($before[.], $after[.] | sub("^[~^]"; ""))]
    | @tsv
  ' "$manifest" |
    while IFS=$'\t' read -r name slug dependency from to; do
      file=".changeset/dependabot-$package-$slug.md"
      printf -- '---\n"%s": patch\n---\n\nUpdate `%s` from %s to %s\n' "$name" "$dependency" "$from" "$to" > "$file"
      echo "$file: $name $dependency $from -> $to"
    done
done
