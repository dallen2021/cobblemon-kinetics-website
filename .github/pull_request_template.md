## Summary

<!-- What does this change do for website, studio, data, or publication users? -->

## Motivation

<!-- Why is it needed? Link an issue with "Closes #123" when appropriate. -->

## Testing

- [ ] `pnpm guard && pnpm format:check && pnpm data:verify`
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build:web`
- [ ] `pnpm e2e`, when UI or routing changes
- [ ] `pnpm db:reset && pnpm db:test && pnpm db:lint`, when SQL, RLS, RPCs, Storage, or seed data changes

## Data, security, and migration impact

<!-- Describe schemas, migrations, RLS, auth, public projections, bundle formats, or write "None". -->

## Third-party material

<!-- Identify source, author, license, modifications, and notices. Write "None" for fully original work. -->

## Checklist

- [ ] The change is focused and its shipped behavior is documented honestly.
- [ ] No secrets, raw workbooks, private notes, dumps, production-derived preview data, or machine-specific paths are included.
- [ ] Public-data changes are deterministic and cannot contain private-schema fields.
- [ ] Every exposed database object remains deny-by-default and policy-tested.
- [ ] Task ownership was not inferred from author, suggester, importer, or editor.
- [ ] No generated Pokémon/machine substitute or unapproved third-party game asset is included.
- [ ] User-facing behavior remains keyboard accessible and responsive.
- [ ] `CHANGELOG.md` is updated, or the change has no user-visible effect.
- [ ] The contribution is compatible with MPL-2.0.

## Screenshots

<!-- Include light/dark and responsive evidence for visible interface changes. -->
