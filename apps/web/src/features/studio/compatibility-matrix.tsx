"use client";

import { ArrowsLeftRight, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import type { StudioRecord, StudioRelationshipSummary } from "@/data/studio-types";

function text(object: StudioRecord["work"], key: string): string {
  const value = object[key];
  return typeof value === "string" ? value : "";
}

interface CompatibilityLink {
  publicId: string;
  displayName: string;
  workflowState: StudioRelationshipSummary["workflowState"] | "legacy";
}

function RelationshipList({
  items,
  empty = "Unassigned",
}: {
  items: CompatibilityLink[];
  empty?: string;
}) {
  if (!items.length) return <span className="source-note">{empty}</span>;
  return (
    <ul className="compatibility-links">
      {items.map((item) => (
        <li key={item.publicId}>
          <strong>{item.displayName}</strong>
          <RegistryId>{item.publicId}</RegistryId>
          <span>
            {item.workflowState === "legacy"
              ? "Legacy field"
              : item.workflowState.replaceAll("_", " ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CompatibilityMatrix({
  records,
  relationships,
}: {
  records: StudioRecord[];
  relationships: StudioRelationshipSummary[];
}) {
  const [query, setQuery] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const configured = useMemo(() => {
    const assignments = relationships.filter(
      (relationship) => relationship.relationshipKind === "assigned_to_job",
    );
    const worksitesByJob = new Map<string, CompatibilityLink[]>();
    for (const relationship of relationships) {
      if (relationship.relationshipKind !== "operates_at") continue;
      const list = worksitesByJob.get(relationship.source.publicId) ?? [];
      list.push({
        publicId: relationship.target.publicId,
        displayName: relationship.target.displayName,
        workflowState: relationship.workflowState,
      });
      worksitesByJob.set(relationship.source.publicId, list);
    }
    return new Map(
      records.map((record) => {
        const recordAssignments = assignments.filter(
          (relationship) => relationship.source.speciesPublicId === record.publicId,
        );
        const jobs: CompatibilityLink[] = recordAssignments.map((relationship) => ({
          publicId: relationship.target.publicId,
          displayName: relationship.target.displayName,
          workflowState: relationship.workflowState,
        }));
        const worksites = recordAssignments.flatMap(
          (relationship) => worksitesByJob.get(relationship.target.publicId) ?? [],
        );
        const legacyJob = text(record.work, "job_id");
        const legacyMachine = text(record.work, "machine_id");
        if (!jobs.length && legacyJob) {
          jobs.push({
            publicId: legacyJob,
            displayName: legacyJob.split(":").at(-1)?.replaceAll("_", " ") ?? legacyJob,
            workflowState: "legacy",
          });
        }
        if (!worksites.length && legacyMachine) {
          worksites.push({
            publicId: legacyMachine,
            displayName: legacyMachine.split(":").at(-1)?.replaceAll("_", " ") ?? legacyMachine,
            workflowState: "legacy",
          });
        }
        return [record.publicId, { jobs, worksites }] as const;
      }),
    );
  }, [records, relationships]);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/^#/u, "");
    return records.filter((record) => {
      const links = configured.get(record.publicId);
      return (
        (!onlyConfigured || Boolean(links?.jobs.length || links?.worksites.length)) &&
        (!normalized ||
          record.displayName.toLowerCase().includes(normalized) ||
          record.publicId.includes(normalized) ||
          String(record.nationalDex) === normalized)
      );
    });
  }, [configured, onlyConfigured, query, records]);
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
                <th>Worksite</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const links = configured.get(record.publicId) ?? { jobs: [], worksites: [] };
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
                      <RelationshipList items={links.jobs} />
                    </td>
                    <td>
                      <RelationshipList items={links.worksites} />
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
