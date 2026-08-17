"use client";

import { Kanban, UsersThree, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, RegistryId, StatusLamp } from "@/components/ui";
import type { StudioAssignee, StudioRecord } from "@/data/studio-types";
import { setStudioWorkItemAssignments } from "@/server/studio-beta-actions";

interface WorkboardValues {
  selected: string[];
  handoffNote: string;
  status: string;
  priority: string;
}

function valuesFor(record: StudioRecord): WorkboardValues {
  const planning = record.planning;
  return {
    selected: record.workItemAssignees.map((member) => member.authUserId),
    handoffNote:
      typeof planning.handoff_note === "string"
        ? planning.handoff_note
        : typeof planning.ownership_handoff_notes === "string"
          ? planning.ownership_handoff_notes
          : "",
    status:
      typeof planning.status === "string" ? planning.status : (record.taskStatus ?? "backlog"),
    priority: typeof planning.priority === "string" ? planning.priority : "normal",
  };
}

function recordLink(record: StudioRecord): string | null {
  const linked = record.planning.linked_record;
  if (typeof linked !== "string") return null;
  const slug = linked.split("/").at(-1);
  return slug ? `/studio/pokemon/${slug}` : null;
}

export function Workboard({
  tasks,
  members,
}: {
  tasks: StudioRecord[];
  members: StudioAssignee[];
}) {
  const [records, setRecords] = useState(tasks);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, WorkboardValues>>(() =>
    Object.fromEntries(tasks.map((task) => [task.publicId, valuesFor(task)])),
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((task) => {
      const draft = drafts[task.publicId] ?? valuesFor(task);
      return (
        (!normalized ||
          task.displayName.toLowerCase().includes(normalized) ||
          task.publicId.includes(normalized)) &&
        (!statusFilter || draft.status.toLowerCase().replaceAll(" ", "_") === statusFilter)
      );
    });
  }, [drafts, query, records, statusFilter]);

  function update(publicId: string, patch: Partial<WorkboardValues>) {
    setDrafts((current) => ({
      ...current,
      [publicId]: {
        ...(current[publicId] ?? {
          selected: [],
          handoffNote: "",
          status: "backlog",
          priority: "normal",
        }),
        ...patch,
      },
    }));
  }

  async function save(task: StudioRecord) {
    const draft = drafts[task.publicId] ?? valuesFor(task);
    if (draft.selected.length > 1 && !draft.handoffNote.trim()) {
      setMessage("Shared work needs a handoff note before it can be saved.");
      return;
    }
    setPending(task.publicId);
    try {
      await setStudioWorkItemAssignments({
        publicId: task.publicId,
        expectedRevision: task.revision,
        assigneeIds: draft.selected,
        handoffNote: draft.handoffNote,
        status: draft.status,
        priority: draft.priority,
      });
      setRecords((current) =>
        current.map((record) =>
          record.publicId === task.publicId
            ? {
                ...record,
                revision: record.revision + 1,
                taskStatus: draft.status,
                workItemAssignees: members.filter((member) =>
                  draft.selected.includes(member.authUserId),
                ),
                planning: {
                  ...record.planning,
                  status: draft.status,
                  priority: draft.priority,
                  handoff_note: draft.handoffNote,
                },
              }
            : record,
        ),
      );
      setMessage(`${task.displayName} saved with explicit ownership only.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The work item could not be saved.");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="studio-page workboard-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Kanban aria-hidden="true" /> Neutral ownership
          </p>
          <h1>Workboard</h1>
          <p className="lede">
            Every Gen 1 design task starts unassigned. Daniel and Jake can explicitly assign, share,
            or hand off work without ownership being inferred from source data.
          </p>
        </div>
      </header>
      <section className="directory-controls material-panel" aria-label="Workboard filters">
        <label className="directory-search" htmlFor="workboard-search">
          <span className="sr-only">Search work items</span>
          <input
            id="workboard-search"
            placeholder="Search task or linked record"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All states</option>
            <option value="backlog">Backlog</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </label>
        <p className="fine-print">
          <UsersThree aria-hidden="true" /> {members.length} active collaborators
        </p>
      </section>
      <p className="workboard-message" aria-live="polite">
        {message}
      </p>
      {filtered.length ? (
        <div className="workboard-list">
          {filtered.map((task) => {
            const draft = drafts[task.publicId] ?? valuesFor(task);
            const linked = recordLink(task);
            return (
              <article className="work-item-card material-panel" key={task.publicId}>
                <div className="work-item-title">
                  <div>
                    <p className="eyebrow">{task.recordKind.replaceAll("_", " ")}</p>
                    <h2>{task.displayName}</h2>
                    <RegistryId>{task.publicId}</RegistryId>
                  </div>
                  <StatusLamp
                    tone={
                      draft.status === "blocked"
                        ? "red"
                        : draft.status === "done"
                          ? "green"
                          : "amber"
                    }
                    label={draft.status.replaceAll("_", " ")}
                  />
                </div>
                {linked ? (
                  <Link className="source-note" href={linked}>
                    Open linked Pokémon record
                  </Link>
                ) : null}
                <div className="work-item-controls">
                  <label>
                    <span>Status</span>
                    <select
                      value={draft.status}
                      onChange={(event) => update(task.publicId, { status: event.target.value })}
                    >
                      <option value="backlog">Backlog</option>
                      <option value="ready">Ready</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={draft.priority}
                      onChange={(event) => update(task.publicId, { priority: event.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>
                <fieldset className="assignee-picker">
                  <legend>Explicit assignees</legend>
                  {members.map((member) => (
                    <label key={member.authUserId}>
                      <input
                        type="checkbox"
                        checked={draft.selected.includes(member.authUserId)}
                        onChange={(event) =>
                          update(task.publicId, {
                            selected: event.target.checked
                              ? [...draft.selected, member.authUserId].slice(0, 2)
                              : draft.selected.filter((id) => id !== member.authUserId),
                          })
                        }
                      />{" "}
                      {member.displayName} <small>{member.role}</small>
                    </label>
                  ))}
                </fieldset>
                <label className="field-label" htmlFor={`handoff-${task.slug}`}>
                  Handoff / division note
                  <textarea
                    id={`handoff-${task.slug}`}
                    rows={2}
                    value={draft.handoffNote}
                    placeholder="Required only when deliberately shared"
                    onChange={(event) => update(task.publicId, { handoffNote: event.target.value })}
                  />
                </label>
                <button
                  className="button button-secondary"
                  disabled={pending === task.publicId}
                  type="button"
                  onClick={() => void save(task)}
                >
                  {pending === task.publicId ? "Saving…" : "Save task"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No work items match">
          <p>Clear a filter to return to the neutral Gen 1 backlog.</p>
        </EmptyState>
      )}
      <p className="source-note">
        <WarningCircle aria-hidden="true" /> Suggested-by and imported owner-like text are retained
        as provenance, never converted to assignments.
      </p>
    </main>
  );
}
