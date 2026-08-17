# Changelog

All notable user-visible changes to the Cobblemon Kinetics website, studio, and
data toolchain are documented here.

## [Unreleased]

### Added

- Independent website/data repository extracted from
  `dallen2021/cobblemon-kinetics@4965dac`.
- Approved Cobblemon Kinetics brand master, transparent emblem, wordmark, and
  application-icon variants.
- Workshop Ledger Studio shell with light/dark themes and collapsible
  navigation and inspector rails.
- Gen 1 Development Studio Beta: 151 editable Pokémon records, 18 type plans,
  linked neutral work items, generic record revisions/comments/conflicts, and
  a controlled transactional workbook importer with private provenance and
  flavor-text quarantine.

### Changed

- Publication tooling now writes canonical Git-published data independently
  and exposes a separate explicit mod-profile export with a versioned JSON
  Schema, clean-checkout provenance, and committed-byte verification.
- Generated Pokémon-like workers and generated machine/workflow substitutes
  were removed; exact subject art now requires an approved source.

## Initial private prototype - 2026-08-14

### Added

- Private-first Next.js and Supabase Squirtle → Hydro Coupler vertical slice.
- GitHub OAuth, numeric-ID allowlisting, equal maintainer roles, immutable
  revisions, optimistic conflicts, approval history, and private/public data
  separation.
- JSON Schema contracts, deterministic publication tools, public manifests,
  and a rights-safe Generation 1 workbook dry-run importer.
- Deny-by-default database policies, Storage gates, pgTAP coverage, generated
  database types, browser/accessibility smoke tests, repository hygiene guards,
  and prototype backup tooling.
