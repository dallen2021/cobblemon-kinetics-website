"use client";

import { ArrowsLeftRight, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import type { StudioRecord } from "@/data/studio-types";

function text(object: StudioRecord["work"], key: string): string {
  const value = object[key];
  return typeof value === "string" ? value : "";
}

export function CompatibilityMatrix({ records }: { records: StudioRecord[] }) {
  const [query, setQuery] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/^#/u, "");
    return records.filter((record) => {
      const job = text(record.work, "job_id");
      const machine = text(record.work, "machine_id");
      return (
        (!onlyConfigured || Boolean(job || machine)) &&
        (!normalized ||
          record.displayName.toLowerCase().includes(normalized) ||
          record.publicId.includes(normalized) ||
          String(record.nationalDex) === normalized)
      );
    });
  }, [onlyConfigured, query, records]);
  return (
    <main className="studio-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <ArrowsLeftRight aria-hidden="true" /> Explicit relationships
          </p>
          <h1>Compatibility matrix</h1>
          <p className="lede">
            A blank relationship is meaningful: Gen 1 records do not receive a job, machine, or
            output merely because of their type.
          </p>
        </div>
      </header>
      <section className="directory-controls material-panel">
        <label className="directory-search" htmlFor="matrix-search">
          <MagnifyingGlass aria-hidden="true" />
          <span className="sr-only">Search compatibility records</span>
          <input
            id="matrix-search"
            placeholder="Search Dex, name, or ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="matrix-toggle">
          <input
            checked={onlyConfigured}
            type="checkbox"
            onChange={(event) => setOnlyConfigured(event.target.checked)}
          />{" "}
          Show configured only
        </label>
      </section>
      {rows.length ? (
        <div className="table-shell compatibility-table">
          <table>
            <thead>
              <tr>
                <th>Pokémon</th>
                <th>Types</th>
                <th>Job</th>
                <th>Machine</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const job = text(record.work, "job_id");
                const machine = text(record.work, "machine_id");
                return (
                  <tr key={record.publicId}>
                    <td>
                      <Link href={`/studio/pokemon/${record.slug}`}>
                        <strong>
                          #{String(record.nationalDex).padStart(3, "0")} {record.displayName}
                        </strong>
                      </Link>
                      <RegistryId>{record.cobblemonSpeciesId ?? record.publicId}</RegistryId>
                    </td>
                    <td>
                      {record.types.map((type) => (
                        <TypeChip key={type} type={type} />
                      ))}
                    </td>
                    <td>
                      {job ? (
                        <RegistryId>{job}</RegistryId>
                      ) : (
                        <span className="source-note">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {machine ? (
                        <RegistryId>{machine}</RegistryId>
                      ) : (
                        <span className="source-note">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusLamp
                        tone={
                          record.workReady === "tested"
                            ? "green"
                            : record.workReady === "not_started"
                              ? "teal"
                              : "amber"
                        }
                        label={record.workReady.replaceAll("_", " ")}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No compatibility rows match">
          <p>Clear a filter to view the Gen 1 planning matrix.</p>
        </EmptyState>
      )}
    </main>
  );
}
