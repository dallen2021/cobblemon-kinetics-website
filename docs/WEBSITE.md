# Website and private studio

This repository contains the private-first Next.js studio, Git-backed wiki,
Supabase schema, and publication toolchain for Cobblemon Kinetics. The NeoForge
mod is maintained separately at
[`dallen2021/cobblemon-kinetics`](https://github.com/dallen2021/cobblemon-kinetics).
The first hosted installation is a **prototype**: it is suitable for Daniel
and Jake to validate the workflow, but not for public launch or irreplaceable
production data.

## Authority and data boundaries

There is intentionally no two-way synchronization:

```text
private workbook -> reviewed importer -> Supabase drafts and revisions
Supabase approved revisions -> immutable publication bundle
publication bundle -> local deterministic exporter -> data/published
Git pull request -> website main -> wiki deployment
reviewed explicit mod export -> separate mod pull request -> Gradle build
```

- Supabase is authoritative for collaborative drafts, comments, revision
  history, validation state, and publication batches.
- `data/published` on `main` is authoritative for public content.
- Mod-facing work profiles are exported explicitly from the reviewed snapshot,
  then proposed to the mod repository in their own pull request. This tool does
  not mutate a sibling checkout implicitly.
- Wiki routes import only Git-published data. They never query draft tables.
- Raw workbooks, import output, database dumps, private notes, secrets, and
  unapproved assets stay outside Git.

Approval in Supabase freezes a revision; it does not publish anything by
itself. Publication still requires a normal Git review and merge.

## Repository layout

| Path                  | Responsibility                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js App Router wiki, private studio, auth routes, and health check                   |
| `packages/domain`     | JSON Schema contracts, generated TypeScript types, and public-field validators           |
| `packages/data-tools` | Workbook import, publication application, reconciliation, access, and asset-policy tools |
| `data/published`      | Canonical reviewed public records and content manifest                                   |
| `data/migration`      | Sanitized mapping specifications and rights-safe fixtures                                |
| `supabase`            | SQL migrations, deny-by-default RLS, local seed, and policy tests                        |

The website and mod repositories build independently. A website build never
invokes Gradle, and a mod build never installs Node packages or contacts
Supabase.

## Local prerequisites

- Node.js 24, pinned in `.node-version`.
- pnpm 11.19.0, pinned in the root `packageManager` field.
- Docker Desktop (or a compatible Docker runtime) for local Supabase.
- `age` and `tar` only when creating an encrypted prototype backup.

Use Corepack to activate the committed package-manager version:

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
```

Copy `.env.example` to `apps/web/.env.local`, then fill it only with local or
hosted values needed by Next.js. Never commit that file. Root CLI commands such
as `data:apply`, `access:grant`, and `backup:create` do not read Next.js env
files; export their documented variables in the invoking shell or inject them
with your local secret manager. For a UI-only review without a database, set
`STUDIO_FIXTURE_MODE=true`; fixture mode is forbidden in the production
deployment.

Start the local services and verify this repository:

```sh
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
pnpm dev
```

Stop local services with `pnpm db:stop --no-backup` when finished.

The Supabase CLI's Docker ports may be reachable from the local network rather
than only from loopback. This repository therefore seeds synthetic Squirtle and
Hydro data only. Do not load private workbook data into local Supabase on an
untrusted network; use a host firewall or isolated development VM when private
data is present, and stop the stack immediately when it is not being tested.
The normal web development command binds Next.js to `127.0.0.1`; any deliberate
LAN test must keep fixture mode disabled and retain normal authentication.

## Authentication and equal maintainer access

Only GitHub OAuth is enabled. Authorization uses stable GitHub numeric user IDs
stored in `editor_allowlist`; usernames and roles are not hard-coded in source.
Every protected request verifies the signed-in identity and then reads active
database membership. Browser-supplied user metadata is never trusted for
authorization.

After linking the intended Supabase project and setting server-only credentials,
grant access with the universal command:

```sh
pnpm access:grant -- --github-user <login> --role maintainer
```

For this root command, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`
must be present in the command's process environment. The tool permits plain
HTTP only for a loopback local Supabase URL and requires HTTPS for hosted
projects so the secret is never intentionally transmitted in clear text.

Run it once for Daniel and once for Jake. Both receive the same `maintainer`
role. The command resolves the current login to its durable numeric GitHub ID;
it does not infer ownership from who ran the command. Disabling an allowlist or
membership row takes effect on the next protected request.

The callback deletes a denied Supabase Auth identity before returning the
denial page. If the provider redirect is interrupted before the callback runs,
an orphan `auth.users` row can remain; it receives no `app_users` membership and
forced RLS denies it all project data. Current first-time OAuth hook payloads do
not reliably expose the durable GitHub numeric identity, so this project does
not weaken the check by trusting email or editable user metadata. Keep the
hosted redirect allowlist exact, review/remove orphan Auth rows during prototype
maintenance, and automate that cleanup before public launch.

Work items and ideas start with no assignee. `suggested_by`, importer identity,
revision author, and task ownership are separate fields. Shared work uses two
explicit assignee rows plus a handoff/division note.

## Workbook import

The workbook path is always an argument, never a repository or machine-specific
constant. Begin with a dry run:

```sh
pnpm data:import -- --workbook /path/to/workbook.xlsx --dry-run \
  --output-dir .private/migration/review
```

The importer checks the workbook hash and exact headers, preserves original and
current typing separately in its normalized intermediate document, derives a
default-form identity for every species, records field transformations, and
quarantines flavor text. Passing a prior `import.json` with `--previous`
classifies rows as imported, updated, or unchanged without mutating either
source. Review the JSON and Markdown reports before any manual use.

This first slice is deliberately **dry-run only**: it does not write to a local
or hosted database. Transactional database application, field-level overwrite
protection, and the full Generation I migration remain a later phase after the
Squirtle/Hydro workflow proves the contracts. Unsupported CLI flags are
rejected so a misspelled output or safety option cannot silently pass.

The raw workbook and full import reports remain ignored. Rights-cleared public
records are reproducible from `data/published`, not from a committed workbook.

## Publication workflow

1. A maintainer validates and approves an exact record revision.
2. The studio creates an immutable batch and downloads a public-only bundle.
3. Apply it locally with `pnpm data:apply -- /path/to/bundle.json`.
4. Run `pnpm data:verify`; a second application must create no diff.
5. Review the changed public records and manifest in a website pull request.
6. CI scans Git history for secrets without posting bot comments, then validates
   the JSON Schemas, deterministic hashes, website, and database policies.
7. After merge and deployment, reconcile the batch with the exact Git commit.
8. When a mod-facing profile changes, generate an explicit mod export and open
   a separate pull request in `dallen2021/cobblemon-kinetics`.

Generate the portable artifact from the reviewed website commit:

```sh
pnpm data:export-mod -- \
  --source-repository dallen2021/cobblemon-kinetics-website \
  --source-commit <40-character-website-commit> \
  --output .private/mod-export
```

The export contains a provenance manifest and sorted `work_profiles/*.json`.
It reads only `data/published` and succeeds only when the requested GitHub
repository and commit match this checkout's `origin` and exact `HEAD`, the
entire checkout is clean, and every publication byte matches that commit. Its
output must be an ignored `.private/**/mod-export` directory with no tracked
files. It never edits the mod checkout. Copy the artifact into a mod feature
branch, validate `manifest.json` with
`packages/domain/schemas/mod-export-manifest.schema.json`, verify its hashes,
and review it through an ordinary mod pull request.

Reconciliation accepts only a 40-character commit reachable from the configured
GitHub repository's default branch (or the optional `PUBLICATION_BRANCH`). The
server fetches every manifest-listed file at that immutable commit, checks its
byte hash and canonical JSON against the frozen batch, and only then records the
batch as published through a service-role-only database RPC.

Private notes, comments, actor IDs, raw import rows, and unpublished assets do
not exist in the public bundle schema, so omission does not depend on a fragile
list of fields to delete.

The mod validates the first work-profile format on server-data reload and
accepts only registered code-side workstation adapters. The Hydro profile is a
validated cross-repository contract in this slice; existing Hydro gameplay
still uses its current config and saved-data path until that migration is
tested separately.

## Asset policy

All third-party asset providers start disabled. The v1 website uses original
CSS panels, type badges, mechanical glyphs, and neutral silhouettes. It does
not extract or publish Pokémon, Minecraft, Create, Cobblemon, PokéAPI, or add-on
artwork.

An asset can advance beyond private candidate status only after a human records
its source archive, exact path and hashes, license, attribution, allowed
visibility, reviewer, and review date. Public files are immutable and
content-addressed. Source JARs and unapproved originals never enter Git.

## Private prototype deployment

Create one Supabase Free project and one Vercel Hobby project. Configure the
Vercel project with `apps/web` as its Root Directory and keep
`SITE_ACCESS_MODE=private`. Production must have real Supabase values,
`STUDIO_FIXTURE_MODE=false`, a random publication-signing key, and the two
bucket names from `.env.example`.

Configure only the GitHub provider in Supabase Auth. Register the exact hosted
callback and application redirect URLs; do not use wildcard production
redirects. Run all committed migrations, create the private buckets, grant both
maintainers, and verify that an unlisted GitHub identity is rejected before
importing the private workbook.

Pull-request previews contain only committed published fixtures. They receive
no production Supabase, OAuth, Storage, signing, or backup credentials, and
studio mutation is disabled. Full Auth/RLS integration tests run against local
Supabase in CI.

Vercel Hobby is personal/noncommercial, and Supabase Free lacks the recovery
and staging guarantees required for public or irreplaceable use. Upgrade to
paid, shared infrastructure with managed backups, protected previews,
persistent staging, and a tested restore procedure before public launch,
monetization, or production reliance.

## Backup and recovery

Export `BACKUP_AGE_RECIPIENT` to an age public recipient, link the intended
Supabase project, and run:

```sh
pnpm backup:create
```

For local Supabase, set `BACKUP_SOURCE=local`. The command writes only an
encrypted archive beneath ignored `.private/backups`; it includes roles,
schema, data, hashes, and a Storage inventory. The inventory is not a backup of
Storage object bytes, so keep separately protected copies of any irreplaceable
originals. Store the latest encrypted archive off the development working
directory and rehearse a restore into a disposable project.

Published content can be rolled back with an ordinary Git revert plus an
audited rollback batch. Database schema corrections use forward migrations.
The website can be rolled back by promoting the previous reviewed Vercel
deployment.
