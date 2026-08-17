# Cobblemon Kinetics

> The private planning studio, public-data pipeline, and future wiki for Create: Cobblemon Kinetics.

[![Web and Data](https://github.com/dallen2021/cobblemon-kinetics-website/actions/workflows/web.yml/badge.svg)](https://github.com/dallen2021/cobblemon-kinetics-website/actions/workflows/web.yml)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

This repository is the web and data companion to the
[Create: Cobblemon Kinetics mod](https://github.com/dallen2021/cobblemon-kinetics).
It contains the Next.js website, private collaborative studio, Supabase schema,
Generation 1 planning importer, language-neutral data contracts, and
deterministic publication tools. The Minecraft mod and Gradle build live in the
separate mod repository.

The hosted installation is currently a **private prototype**. It is not a
production-grade content service, and its wiki is not public yet.

## What exists today

- A Next.js App Router website with private, published-public, and maintenance
  access modes.
- GitHub OAuth through Supabase Auth plus a database-backed numeric-ID
  allowlist.
- Equal `maintainer` authority for Daniel and Jake; neither is a subordinate or
  default owner of project work.
- A private Gen 1 Development Studio Beta: all 151 species have editable draft
  records, neutral design tasks, autosave, immutable revisions, 20-second
  stale-record checks, comments, approval, publication bundles, and Git
  reconciliation.
- Evolution-aware Pokémon workspaces with controlled fact selectors, 78
  normalized families, explicit evolution edges, and a shared Kinetic Blueprint
  canvas/outline editor for capabilities, jobs, worksites, interlocks, and
  bounded results.
- SQL migrations, deny-by-default RLS, Storage policies, pgTAP tests, and
  generated database types.
- JSON Schema contracts and deterministic public-data tooling.
- A controlled, hash-locked workbook importer that maps the Generation 1
  planning workbook transactionally, preserves source provenance and override
  conflicts, and quarantines flavor text.
- Original project branding and neutral interface art. Generated Pokémon and
  generated Create-machine substitutes are prohibited.

## Sources of truth

| Data                                                     | Authority                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Collaborative drafts, private notes, comments, revisions | Supabase                                                     |
| Approved public records                                  | `data/published` on `main`                                   |
| JSON contracts and generated TypeScript types            | `packages/domain`                                            |
| Published-data import/export tools                       | `packages/data-tools`                                        |
| Mod-facing work profiles                                 | Explicit deterministic export reviewed in the mod repository |
| Website UI and studio                                    | `apps/web`                                                   |

There is no automatic two-way synchronization. Approval in Supabase freezes a
revision; it does not publish it. Publishing still requires a reviewed Git pull
request and a verified commit on `main`.

## Local development

### Requirements

- Git
- Node.js 24 LTS, matching [`.node-version`](.node-version)
- Corepack and the exact pnpm version declared in [`package.json`](package.json)
- Docker Desktop or another Docker-compatible runtime for local Supabase

### Start the project

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm dev
```

The development server binds to `127.0.0.1` intentionally. Local Supabase may
publish Docker ports on the LAN depending on the host setup; do not import
private workbook data on an untrusted network, and run `pnpm db:stop` when the
stack is not in use.

For fixture-only UI work without OAuth or a hosted database, set the documented
fixture variables in `apps/web/.env.local`. Fixture mode is accepted only for a
loopback app URL and loopback request host.

## Checks

Run the complete web/data suite from the repository root:

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

The required GitHub check is **Web, data, and database contracts**. CI receives
no production Supabase, OAuth, Storage, signing, backup, or private-workbook
credentials.

## Publication flow

1. A maintainer edits and validates a draft in the private studio.
2. Either maintainer may approve the exact current revision.
3. The studio creates an immutable, public-only publication bundle.
4. A maintainer applies the bundle locally with `pnpm data:apply`.
5. CI validates schemas, hashes, private-field exclusion, database policies,
   browser behavior, and deterministic output.
6. A normal pull request is squash-merged to `main`.
7. The studio reconciles the batch against the exact default-branch commit and
   verifies every manifest file and SHA-256.
8. A separate explicit export updates the mod repository through its own
   human-reviewed pull request.

Create that portable export only after the website publication is reviewed:

```sh
pnpm data:export-mod -- \
  --source-repository dallen2021/cobblemon-kinetics-website \
  --source-commit <40-character-website-commit> \
  --output .private/mod-export
```

The command reads only canonical `data/published` input and writes a portable
manifest plus `work_profiles/` under the chosen repository-local output. It
requires the requested repository and commit to match this checkout's GitHub
`origin` and exact `HEAD`, refuses any dirty checkout, and byte-compares every
publication file with the committed tree. Output is restricted to an ignored
`.private/**/mod-export` directory and may not contain tracked files. The tool
never writes into a sibling checkout. Copy the reviewed artifact into a branch
of the mod repository, validate it against
`packages/domain/schemas/mod-export-manifest.schema.json`, and open a separate
pull request there.

See [`docs/WEBSITE.md`](docs/WEBSITE.md) for the complete architecture,
environment, access, migration, publication, backup, and deployment runbook.

## Private workbook and planning data

Raw workbooks, private notes, import intermediates, database dumps, and backup
artifacts must remain under ignored `.private/` paths. They must never be
committed, attached to public issues, or copied into preview deployments.

Task ownership is neutral by default. Author, suggester, importer, and editor
are not assignees. Assign Daniel, Jake, or another contributor only after an
explicit decision. Shared ownership uses separate assignee records and a short
division or handoff note.

## Kinetic Blueprint workflow

Every Pokémon workspace opens on a compact Overview and keeps Facts, Blueprint,
and Discussion & History separate. The Blueprint is a visual editor over the
same immutable records used by directories and publication; it is never a
second data store. Canvas and Outline stage the same typed change set, and Apply
validates record heads and saves relationships plus shared layout atomically.

Evolution never copies facts or silently scales work. Descendants review each
inherited capability or job as Keep, Raise, Lower, Replace, Remove, or Add.
Parent edits mark descendant decisions outdated without rewriting them. Type
Workshop directions remain suggestions until a maintainer explicitly accepts
one for a specific form. Compatibility derives job/worksite rows from these
durable relationships, while personal zoom and filters remain private to each
maintainer.

### Applying a reviewed Gen 1 workbook locally

First create and review the normalized import document; it stays under ignored
`.private/` storage:

```sh
pnpm data:import -- --workbook /path/to/workbook.xlsx --dry-run \
  --output-dir .private/migration/review
```

Then, with a local Supabase stack and its service key exported only into the
current shell, apply the exact reviewed source hash:

```sh
pnpm data:apply-import -- \
  --input .private/migration/review/import.json \
  --expect-source-sha256 <reviewed-workbook-sha256> \
  --confirm-apply yes
```

The same source hash is an idempotent no-op. A hosted apply additionally
requires a newly created encrypted backup manifest under `.private/backups`.
Missing workbook rows never delete records; a changed imported source preserves
the existing record and becomes a private review conflict rather than
overwriting collaboration work.

## Artwork policy

Third-party artwork is denied by default. This repository does not extract or
republish Pokémon, Minecraft, Create, Cobblemon, PokéAPI, or add-on imagery.
Recognizable Pokémon and machine images must come from an explicitly approved,
versioned, provenance-tracked source. Until then the interface uses registry
text, neutral source-required states, original panels, and project branding.

The approved Cobblemon Kinetics logo is project-owned generated brand art. Its
provenance and allowed uses are documented in
[`docs/GENERATED_ART.md`](docs/GENERATED_ART.md).

Maintainers can inspect exact PNG source files from locally installed Create
and Cobblemon JARs without adding them to the repository or deployment:

Keep `LOCAL_GAME_ASSET_ROOT=../../.private/local-game-assets` in the local
`apps/web/.env.local`; never configure that variable in Vercel.

```sh
pnpm assets:import-local -- \
  --create-jar <path-to-create.jar> \
  --create-version 6.0.10 \
  --cobblemon-jar <path-to-cobblemon.jar> \
  --cobblemon-version 1.7.3
```

The command extracts only namespaced PNG entries into ignored
`.private/local-game-assets`, records the JAR and file hashes, and makes them
available on the authenticated Studio asset page only from a loopback,
non-production server. It never approves those files for public use. Create's
asset directory is All Rights Reserved, and a Cobblemon contributor license
does not clear underlying Pokémon character rights; written rights-holder
permission is still required before any subject image can enter Git, Vercel,
public Storage, or a publication bundle.

## Contributing and governance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and
[GOVERNANCE.md](GOVERNANCE.md) for maintainer authority and merge rules. Daniel
and Jake are equal maintainers. A second-maintainer approval is encouraged for
security and publication changes but is not a mandatory repository gate.

Dependabot and automated dependency pull requests are intentionally disabled.
Dependency updates are deliberate, human-reviewed maintenance work.

## License and trademarks

Repository code and original project-owned material are available under the
[Mozilla Public License 2.0](LICENSE), unless a file states otherwise.

Cobblemon Kinetics is independent and unofficial. It is not affiliated with or
endorsed by Mojang, Microsoft, Nintendo, Creatures Inc., GAME FREAK inc., The
Pokémon Company, the Cobblemon team, or the Create team. Their names and marks
belong to their respective owners.
