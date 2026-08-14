# Migration fixtures

This directory contains only sanitized, rights-safe test fixtures. Raw workbooks, private import
documents, reports, database dumps, comments, and quarantined Pokédex text belong under
`.private/migration/` and must never be committed.

The importer accepts the workbook path at runtime and verifies all nine expected sheets. Re-running
with `--previous <import.json>` classifies stable rows as imported, updated, or unchanged by row and
field hashes without inferring ownership.
