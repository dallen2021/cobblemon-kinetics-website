"use client";

import {
  ArrowRight,
  Funnel,
  ListNumbers,
  MagnifyingGlass,
  PawPrint,
  SlidersHorizontal,
  Wrench,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import type { StudioRecord } from "@/data/studio-types";

function destinationFor(record: StudioRecord): string {
  if (record.recordKind === "pokemon_species") return `/studio/pokemon/${record.slug}`;
  if (record.recordKind === "type_workshop") return `/studio/types/${record.slug}`;
  if (record.recordKind === "job") return `/studio/jobs/${record.slug}`;
  if (record.recordKind === "machine" || record.recordKind === "machine_research") {
    return `/studio/machines/${record.slug}`;
  }
  if (record.recordKind === "work_item") return "/studio/workboard";
  return `/studio/history?record=${encodeURIComponent(record.publicId)}`;
}

function compareRecords(left: StudioRecord, right: StudioRecord): number {
  const leftDex = left.nationalDex ?? Number.MAX_SAFE_INTEGER;
  const rightDex = right.nationalDex ?? Number.MAX_SAFE_INTEGER;
  return leftDex - rightDex || left.displayName.localeCompare(right.displayName);
}

function displayType(type: string): string {
  return `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
}

export function RecordDirectory({
  records,
  title,
  description,
  kind,
}: {
  records: StudioRecord[];
  title: string;
  description: string;
  kind: StudioRecord["recordKind"];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const isPokemonDirectory = kind === "pokemon_species";
  const orderedRecords = useMemo(() => [...records].sort(compareRecords), [records]);
  const types = useMemo(
    () => [...new Set(orderedRecords.flatMap((record) => record.types))].sort(),
    [orderedRecords],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase().replace(/^#/u, "");
  const nationalDexQuery =
    normalizedQuery && /^\d+$/u.test(normalizedQuery) ? Number(normalizedQuery) : null;
  const filtered = useMemo(
    () =>
      orderedRecords.filter((record) => {
        const matchesQuery =
          !normalizedQuery ||
          record.nationalDex === nationalDexQuery ||
          [record.displayName, record.publicId, record.slug, record.cobblemonSpeciesId]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
        return (
          matchesQuery &&
          (!type || record.types.includes(type)) &&
          (!workflow || record.workflowState === workflow) &&
          (!taskStatus || record.taskStatus === taskStatus)
        );
      }),
    [nationalDexQuery, normalizedQuery, orderedRecords, taskStatus, type, workflow],
  );
  const advancedFilterCount = Number(Boolean(workflow)) + Number(Boolean(taskStatus));
  const hasFilters = Boolean(query || type || workflow || taskStatus);

  function clearFilters(): void {
    setQuery("");
    setType("");
    setWorkflow("");
    setTaskStatus("");
  }

  return (
    <main className="studio-page record-directory">
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">
            {isPokemonDirectory ? <PawPrint aria-hidden="true" /> : <Wrench aria-hidden="true" />}
            Planning directory
          </p>
          <h1>{title}</h1>
          <p className="lede">{description}</p>
          <div className="directory-guidance">
            <span>
              <ListNumbers aria-hidden="true" />
              {isPokemonDirectory ? "Dex order by default" : "Stable planning order"}
            </span>
            <span>
              <ArrowRight aria-hidden="true" /> Select a row to open its workspace
            </span>
          </div>
        </div>
        <p aria-live="polite" className="directory-count">
          <strong>{filtered.length}</strong> of {orderedRecords.length} records
        </p>
      </header>

      <section className="directory-controls material-panel" aria-label={`${title} filters`}>
        <label className="directory-search">
          <span>
            <MagnifyingGlass aria-hidden="true" /> Search
          </span>
          <input
            aria-label={`Search ${title}`}
            id="studio-record-search"
            placeholder={
              isPokemonDirectory ? "Name, #007, 007, or registry ID" : "Name or stable ID"
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="directory-filter">
          <span>
            <Funnel aria-hidden="true" /> Type
          </span>
          <select
            aria-label="Filter by type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All types</option>
            {types.map((option) => (
              <option key={option} value={option}>
                {displayType(option)}
              </option>
            ))}
          </select>
        </label>
        <details className="directory-advanced-filters">
          <summary>
            <SlidersHorizontal aria-hidden="true" /> More filters
            {advancedFilterCount ? <span>{advancedFilterCount}</span> : null}
          </summary>
          <div>
            <label>
              Workflow
              <select value={workflow} onChange={(event) => setWorkflow(event.target.value)}>
                <option value="">All states</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            {isPokemonDirectory ? (
              <label>
                Task state
                <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
                  <option value="">Any task</option>
                  <option value="backlog">Backlog</option>
                  <option value="ready">Ready</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
            ) : null}
          </div>
        </details>
        {hasFilters ? (
          <button className="directory-clear" type="button" onClick={clearFilters}>
            <X aria-hidden="true" /> Clear
          </button>
        ) : null}
      </section>

      {filtered.length ? (
        <div className="record-directory-list" role="list">
          {filtered.map((record) => (
            <Link
              aria-label={`Open ${record.displayName} workspace`}
              className="record-directory-row"
              href={destinationFor(record)}
              key={record.publicId}
              role="listitem"
            >
              <span className="directory-token" aria-hidden="true">
                {record.nationalDex ? (
                  String(record.nationalDex).padStart(3, "0")
                ) : (
                  <Wrench size={18} />
                )}
              </span>
              <span className="directory-main">
                <span className="directory-title">
                  {isPokemonDirectory ? (
                    <PawPrint aria-hidden="true" />
                  ) : (
                    <Wrench aria-hidden="true" />
                  )}
                  <strong>{record.displayName}</strong>
                </span>
                <RegistryId>{record.cobblemonSpeciesId ?? record.publicId}</RegistryId>
              </span>
              <span className="directory-types">
                {record.types.length ? (
                  record.types.map((entry) => <TypeChip key={entry} type={entry} />)
                ) : (
                  <small className="directory-no-type">No type binding</small>
                )}
              </span>
              <span className="directory-work">
                <StatusLamp
                  tone={
                    record.workflowState === "approved"
                      ? "green"
                      : record.taskStatus === "blocked"
                        ? "red"
                        : "amber"
                  }
                  label={record.workflowState.replace("_", " ")}
                />
                <small>
                  {record.taskCount
                    ? `${record.taskCount} linked task${record.taskCount === 1 ? "" : "s"}`
                    : record.workReady.replaceAll("_", " ")}
                </small>
              </span>
              <ArrowRight aria-hidden="true" className="directory-open-icon" weight="bold" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No matching records">
          <p>Clear a filter or try a Pokémon name, Dex number, or registry ID.</p>
          {hasFilters ? (
            <button className="button button-secondary" type="button" onClick={clearFilters}>
              <X aria-hidden="true" /> Clear filters
            </button>
          ) : null}
        </EmptyState>
      )}
    </main>
  );
}
