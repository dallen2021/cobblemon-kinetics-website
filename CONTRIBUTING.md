# Contributing to the Cobblemon Kinetics website

Contributions to the website, studio, schemas, migrations, tests,
documentation, accessibility, and legally original interface art are welcome.
The Minecraft mod itself lives at
[`dallen2021/cobblemon-kinetics`](https://github.com/dallen2021/cobblemon-kinetics).

By contributing, you agree that your contribution may be distributed under
the repository's [Mozilla Public License 2.0](LICENSE) and that you have the
right to provide every part of it.

## Before starting

- Search open and closed issues and pull requests.
- Open an issue before changing a public schema, publication boundary, access
  model, migration strategy, external dependency, or rights policy.
- Keep one pull request focused on one concern.
- Never include secrets, database dumps, raw workbooks, private notes,
  production-derived data, or machine-specific paths.
- Do not infer task ownership. Author, suggester, importer, and editor are
  separate from assignee.

## Development setup

Use Node 24 and the exact pnpm version declared by the repository.

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
pnpm db:start
pnpm db:reset
pnpm dev
```

Stop local Supabase when it is not needed:

```sh
pnpm db:stop
```

Do not load private data while Docker-published Supabase ports are reachable
from an untrusted network.

## Branches, commits, and pull requests

1. Branch from `main` with a short prefix such as `feat/`, `fix/`, `docs/`,
   `test/`, `refactor/`, `build/`, or `chore/`.
2. Prefer Conventional Commit summaries, for example
   `fix(auth): reject unsafe callback redirects`.
3. Keep commits reviewable and do not mix formatting churn with functional
   changes.
4. Update from `main` before final review when the branch has drifted.
5. Open a pull request and resolve review conversations.
6. After the required check passes, either maintainer may squash-merge it.

The repository has no long-lived `develop` branch. Squash merge is the only
merge method, and merged branches are deleted automatically.

## Required checks

Before requesting review, run the checks relevant to the change. For a broad
change, run all of them:

```sh
pnpm guard
pnpm format:check
pnpm data:verify
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm db:test
pnpm db:lint
pnpm build:web
pnpm db:stop
```

Database changes must rebuild from an empty local database and pass pgTAP.
Generated database types and generated domain types must remain deterministic
and checked in.

## Code and data expectations

- Keep Server Components as the default; add Client Components only for real
  interaction.
- Verify authentication and active database membership in every protected
  Server Action and Route Handler. Redirect middleware is not authorization.
- Never expose a Supabase secret/service key to the browser.
- Require HTTPS for hosted Supabase origins; allow HTTP only for exact loopback
  development hosts.
- Enable and test deny-by-default RLS for every exposed table.
- Keep `SECURITY DEFINER` functions private, narrowly granted, and explicit
  about actor authorization.
- Use expected revisions and immutable history; never silently apply
  last-write-wins.
- Keep public projections allowlisted and unable to represent private notes,
  comments, actors, raw imports, quarantined text, or unpublished assets.
- Keep JSON output canonically sorted and byte-deterministic.
- Treat `data/published` as generated reviewed output; do not hand-edit files
  that have a generator.
- Keep mod exports explicit. Export only from a clean, committed website
  checkout into ignored `.private/**/mod-export`; tooling must never mutate a
  sibling mod checkout.

## Supabase migrations

Create migrations with the repository-pinned Supabase CLI rather than naming
files manually:

```sh
pnpm exec supabase migration new descriptive_name
```

Use forward corrective migrations. Do not rewrite a migration that has reached
the hosted project. Run the database linter, policy tests, and generated-type
check before review.

## User interface and accessibility

- Target WCAG 2.2 AA.
- Preserve keyboard access, visible focus, semantic labels, reduced motion,
  and useful error summaries.
- Test the Studio at desktop, tablet, and phone widths.
- Status must never be conveyed by color alone.
- Keep editable text as HTML. Do not bake button, field, status, or navigation
  copy into image assets.

## Artwork and provenance

Do not commit recognizable Pokémon, Poké Ball, Minecraft, Cobblemon, Create, or
add-on imagery without a documented rights review. Do not generate imitation
Pokémon or machine sprites as substitutes.

Original project branding and interface art must include provenance, source
hashes, transformation steps, output hashes, reviewer, approval date, and a
clear usage boundary. Every third-party asset starts denied.

## Documentation

Update:

- `README.md` for contributor-facing setup or repository boundaries;
- `docs/WEBSITE.md` for architecture, auth, publication, backup, or deployment;
- `docs/GENERATED_ART.md` for brand or interface asset provenance; and
- `CHANGELOG.md` for user-visible behavior.

Describe shipped behavior honestly. Mark future work as planned rather than
implying it already exists.
