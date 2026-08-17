"use client";

import {
  ArrowClockwise,
  CheckCircle,
  ChatCircleText,
  ClipboardText,
  Flask,
  FloppyDisk,
  LockKey,
  Scales,
  TreeStructure,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { EfficiencyGauge, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import type {
  StudioComment,
  StudioObject,
  StudioRecord,
  StudioRecordDetail,
} from "@/data/studio-types";
import {
  addStudioComment,
  approveStudioRecord,
  checkStudioRecordHead,
  saveStudioRecord,
} from "@/server/studio-beta-actions";

type SaveState = "ready" | "dirty" | "saving" | "saved" | "conflict" | "error";

interface EditorValues {
  facts: StudioObject;
  design: StudioObject;
  work: StudioObject;
  balance: StudioObject;
  testing: StudioObject;
  planning: StudioObject;
  privateNote: string;
}

function stringValue(object: StudioObject, key: string): string {
  const value = object[key];
  return typeof value === "string"
    ? value
    : value === null || value === undefined
      ? ""
      : String(value);
}

function numberValue(object: StudioObject, key: string, fallback = 1): number {
  const value = Number(object[key]);
  return Number.isFinite(value) ? value : fallback;
}

function provenanceValue(value: StudioRecordDetail["provenance"][number]["importedValue"]): string {
  const serialized = JSON.stringify(value);
  if (!serialized) return "—";
  return serialized.length > 140 ? `${serialized.slice(0, 137)}…` : serialized;
}

function statusTone(state: SaveState): "green" | "amber" | "red" | "teal" {
  if (state === "saved") return "green";
  if (state === "dirty" || state === "saving") return "amber";
  if (state === "conflict" || state === "error") return "red";
  return "teal";
}

function statusLabel(state: SaveState): string {
  return {
    ready: "Ready",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    conflict: "Remote update",
    error: "Save failed",
  }[state];
}

function valuesFrom(record: StudioRecord): EditorValues {
  return {
    facts: record.facts,
    design: record.design,
    work: record.work,
    balance: record.balance,
    testing: record.testing,
    planning: record.planning,
    privateNote: record.privateNote,
  };
}

function serialise(values: EditorValues): string {
  return JSON.stringify(values);
}

function normalizeSaved(current: StudioRecordDetail, saved: StudioRecord): StudioRecordDetail {
  return {
    ...current,
    ...saved,
    revisions: [
      {
        revision: saved.revision,
        actor: saved.updatedBy,
        at: saved.updatedAt,
        summary: "Saved structured Studio sections.",
      },
      ...current.revisions.filter((revision) => revision.revision !== saved.revision),
    ],
  };
}

export function StudioRecordWorkspace({
  initialRecord,
  linkedRecords = [],
}: {
  initialRecord: StudioRecordDetail;
  linkedRecords?: StudioRecord[];
}) {
  const [record, setRecord] = useState(initialRecord);
  const [values, setValues] = useState<EditorValues>(() => valuesFrom(initialRecord));
  const [saveState, setSaveState] = useState<SaveState>("ready");
  const [message, setMessage] = useState("Valid changes save after 800 ms of inactivity.");
  const [conflict, setConflict] = useState<StudioRecordDetail | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [comments, setComments] = useState<StudioComment[]>(initialRecord.comments);
  const revisionRef = useRef(record.revision);
  const lastSavedRef = useRef(serialise(values));
  const requestInFlightRef = useRef(false);
  const queuedRef = useRef<EditorValues | null>(null);
  const valuesRef = useRef(values);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  function updateSection(
    section: keyof Omit<EditorValues, "privateNote">,
    key: string,
    value: string | number,
  ) {
    setValues((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
    setSaveState("dirty");
    setMessage("");
  }

  function updatePrivateNote(value: string) {
    setValues((current) => ({ ...current, privateNote: value }));
    setSaveState("dirty");
    setMessage("");
  }

  async function performSave(
    next: EditorValues,
    expectedRevision = revisionRef.current,
  ): Promise<boolean> {
    const result = await saveStudioRecord({
      publicId: record.publicId,
      expectedRevision,
      clientMutationId: crypto.randomUUID(),
      patch: {
        facts: next.facts,
        design: next.design,
        work: next.work,
        balance: next.balance,
        testing: next.testing,
        planning: next.planning,
        private_note: next.privateNote,
      },
    });
    if (!result.ok) {
      if (result.kind === "conflict") {
        setConflict(result.current);
        setSaveState("conflict");
        setMessage(
          "Another maintainer saved this record. Refresh it or continue from the newer revision.",
        );
      } else {
        setSaveState("error");
        setMessage(result.message);
      }
      return false;
    }
    revisionRef.current = result.record.revision;
    setRecord((current) => normalizeSaved(current, result.record));
    lastSavedRef.current = serialise(next);
    if (serialise(valuesRef.current) === serialise(next)) {
      setSaveState("saved");
      setMessage(`Revision ${result.record.revision} saved by ${result.record.updatedBy}.`);
    } else {
      setSaveState("dirty");
      setMessage(`Revision ${result.record.revision} saved; newer changes are queued.`);
    }
    return true;
  }

  async function drainAutosave(initial: EditorValues, expectedRevision?: number): Promise<void> {
    queuedRef.current = initial;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    try {
      while (queuedRef.current) {
        const next = queuedRef.current;
        queuedRef.current = null;
        if (serialise(next) === lastSavedRef.current) continue;
        setSaveState("saving");
        if (!(await performSave(next, expectedRevision))) {
          queuedRef.current = null;
          break;
        }
      }
    } catch {
      setSaveState("error");
      setMessage("The record could not be saved. No fields were overwritten.");
    } finally {
      requestInFlightRef.current = false;
    }
  }

  useEffect(() => {
    const current = serialise(values);
    if (current === lastSavedRef.current || conflict) return;
    const timer = window.setTimeout(() => {
      void drainAutosave(structuredClone(values));
    }, 800);
    return () => window.clearTimeout(timer);
    // Queue and revision references deliberately serialize autosave requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, conflict]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void checkStudioRecordHead(record.publicId)
        .then((head) => {
          if (head.revision > revisionRef.current) {
            setSaveState("conflict");
            setMessage("A newer remote revision is available. Refresh before continuing.");
          }
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [record.publicId]);

  async function approve() {
    if (saveState === "dirty" || saveState === "saving" || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setSaveState("saving");
    try {
      const result = await approveStudioRecord(record.publicId, record.revision);
      if (!result.ok) {
        if (result.kind === "conflict") setConflict(result.current);
        setSaveState(result.kind === "conflict" ? "conflict" : "error");
        setMessage(
          result.kind === "conflict" ? "A newer revision must be reviewed first." : result.message,
        );
        return;
      }
      revisionRef.current = result.record.revision;
      setRecord((current) => ({
        ...normalizeSaved(current, result.record),
        workflowState: "approved",
      }));
      setSaveState("saved");
      setMessage(`Approved exact revision ${result.record.revision}.`);
    } finally {
      requestInFlightRef.current = false;
    }
  }

  function refreshConflict() {
    if (!conflict) return;
    setRecord(conflict);
    setValues(valuesFrom(conflict));
    revisionRef.current = conflict.revision;
    lastSavedRef.current = serialise(valuesFrom(conflict));
    setConflict(null);
    setSaveState("ready");
    setMessage("Loaded the current server revision.");
  }

  function continueFromRemote() {
    if (!conflict) return;
    const expected = conflict.revision;
    setRecord(conflict);
    revisionRef.current = expected;
    setConflict(null);
    void drainAutosave(structuredClone(values), expected);
  }

  async function submitComment() {
    if (!commentBody.trim()) return;
    try {
      const comment = await addStudioComment(record.publicId, commentBody);
      setComments((current) => [...current, comment]);
      setCommentBody("");
    } catch {
      setMessage("The private comment could not be saved.");
    }
  }

  const efficiency = numberValue(values.balance, "efficiency", 1);
  const publicRationale = stringValue(values.balance, "public_rationale");
  const machineId = stringValue(values.work, "machine_id");
  const jobId = stringValue(values.work, "job_id");
  const planningTitle = record.recordKind === "type_workshop" ? "Type direction" : "Planning";

  return (
    <div className="editor-layout gen1-record-workspace">
      <section className="editor-canvas" aria-labelledby="editor-title">
        <header className="record-header">
          <div
            className="record-token worker-record-token"
            aria-label={
              record.nationalDex
                ? `National Dex ${record.nationalDex}`
                : `${record.recordKind.replaceAll("_", " ")} record`
            }
          >
            {record.nationalDex ? String(record.nationalDex).padStart(3, "0") : "PLAN"}
          </div>
          <div>
            <p className="eyebrow">
              {record.recordKind.replaceAll("_", " ")} · Revision {record.revision}
            </p>
            <h1 id="editor-title">{record.displayName}</h1>
            <div className="chip-row">
              {record.types.map((type) => (
                <TypeChip key={type} type={type} />
              ))}
              <StatusLamp
                tone={record.workflowState === "approved" ? "green" : "amber"}
                label={record.workflowState.replace("_", " ")}
              />
            </div>
          </div>
          <RegistryId>{record.cobblemonSpeciesId ?? record.publicId}</RegistryId>
        </header>

        <section className="editor-section" aria-labelledby="facts-heading">
          <div className="editor-section-heading">
            <span>01</span>
            <div>
              <h2 id="facts-heading">
                <ClipboardText aria-hidden="true" /> Facts
              </h2>
              <p>
                Imported facts remain editable; provenance stays attached for later import review.
              </p>
            </div>
          </div>
          <div className="studio-field-grid">
            <label className="field-label" htmlFor="genus">
              Genus
              <input
                id="genus"
                value={stringValue(values.facts, "genus")}
                onChange={(event) => updateSection("facts", "genus", event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="habitat">
              Habitat
              <input
                id="habitat"
                value={stringValue(values.facts, "habitat")}
                onChange={(event) => updateSection("facts", "habitat", event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="growth">
              Growth rate
              <input
                id="growth"
                value={stringValue(values.facts, "growth_rate")}
                onChange={(event) => updateSection("facts", "growth_rate", event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="shape">
              Shape
              <input
                id="shape"
                value={stringValue(values.facts, "shape")}
                onChange={(event) => updateSection("facts", "shape", event.target.value)}
              />
            </label>
          </div>
          {record.provenance.length ? (
            <details className="provenance-summary">
              <summary>
                Imported baseline: {record.provenance[0]?.sourceSheet} row{" "}
                {record.provenance[0]?.sourceRow}
              </summary>
              <p className="source-note">
                Original values remain visible here. A later workbook change preserves Studio work
                and creates private review work rather than overwriting it.
              </p>
              <ul>
                {record.provenance.map((field) => (
                  <li key={field.fieldPath}>
                    <code>{field.fieldPath}</code>
                    <span>{provenanceValue(field.importedValue)}</span>
                    <small>
                      {field.sourceSheet} row {field.sourceRow}
                      {field.overriddenAt ? " · Studio override recorded" : " · Imported baseline"}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="editor-section" aria-labelledby="design-heading">
          <div className="editor-section-heading">
            <span>02</span>
            <div>
              <h2 id="design-heading">
                <Wrench aria-hidden="true" /> Design
              </h2>
              <p>Capture candidate directions without silently activating gameplay.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="candidate-job">
            Candidate job
            <input
              id="candidate-job"
              value={stringValue(values.design, "candidate_job")}
              onChange={(event) => updateSection("design", "candidate_job", event.target.value)}
            />
          </label>
          <label className="field-label" htmlFor="create-system">
            Create system
            <input
              id="create-system"
              value={stringValue(values.design, "create_system")}
              onChange={(event) => updateSection("design", "create_system", event.target.value)}
            />
          </label>
          <label className="field-label" htmlFor="hooks">
            Natural design hooks
            <textarea
              id="hooks"
              rows={3}
              value={stringValue(values.design, "natural_design_hooks")}
              onChange={(event) =>
                updateSection("design", "natural_design_hooks", event.target.value)
              }
            />
          </label>
        </section>

        <section className="editor-section" aria-labelledby="work-heading">
          <div className="editor-section-heading">
            <span>03</span>
            <div>
              <h2 id="work-heading">
                <Wrench aria-hidden="true" /> Work
              </h2>
              <p>Registry-backed IDs stay explicit until a reviewed profile is approved.</p>
            </div>
          </div>
          <div className="studio-field-grid">
            <label className="field-label" htmlFor="readiness">
              Readiness
              <select
                id="readiness"
                value={stringValue(values.work, "readiness") || "not_started"}
                onChange={(event) => updateSection("work", "readiness", event.target.value)}
              >
                <option value="not_started">Not started</option>
                <option value="candidate">Candidate</option>
                <option value="prototype">Prototype</option>
                <option value="tested">Tested</option>
              </select>
            </label>
            <label className="field-label" htmlFor="machine-id">
              Machine registry ID
              <input
                id="machine-id"
                value={machineId}
                placeholder="Source required until reviewed"
                onChange={(event) => updateSection("work", "machine_id", event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="job-id">
              Job public ID
              <input
                id="job-id"
                value={jobId}
                placeholder="No assignment by default"
                onChange={(event) => updateSection("work", "job_id", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="editor-section" aria-labelledby="balance-heading">
          <div className="editor-section-heading">
            <span>04</span>
            <div>
              <h2 id="balance-heading">
                <Scales aria-hidden="true" /> Balance
              </h2>
              <p>Every output needs an explainable boundary before approval.</p>
            </div>
          </div>
          <div className="balance-row">
            <label className="field-label" htmlFor="efficiency">
              Efficiency multiplier
              <input
                id="efficiency"
                type="number"
                min="0"
                max="4"
                step="0.05"
                value={efficiency}
                onChange={(event) =>
                  updateSection("balance", "efficiency", event.target.valueAsNumber)
                }
              />
            </label>
            <EfficiencyGauge value={efficiency} />
          </div>
          <label className="field-label" htmlFor="public-rationale">
            Public balance rationale
            <textarea
              id="public-rationale"
              rows={4}
              value={publicRationale}
              onChange={(event) => updateSection("balance", "public_rationale", event.target.value)}
            />
          </label>
        </section>

        <section className="editor-section" aria-labelledby="testing-heading">
          <div className="editor-section-heading">
            <span>05</span>
            <div>
              <h2 id="testing-heading">
                <Flask aria-hidden="true" /> Testing
              </h2>
              <p>Keep a clear scenario and evidence path for the eventual implementation.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="test-scenario">
            Scenario
            <textarea
              id="test-scenario"
              rows={3}
              value={stringValue(values.testing, "scenario")}
              onChange={(event) => updateSection("testing", "scenario", event.target.value)}
            />
          </label>
          <label className="field-label" htmlFor="test-evidence">
            Evidence / result
            <input
              id="test-evidence"
              value={stringValue(values.testing, "evidence")}
              onChange={(event) => updateSection("testing", "evidence", event.target.value)}
            />
          </label>
        </section>

        <section className="editor-section" aria-labelledby="planning-heading">
          <div className="editor-section-heading">
            <span>06</span>
            <div>
              <h2 id="planning-heading">
                <TreeStructure aria-hidden="true" /> {planningTitle}
              </h2>
              <p>
                Keep decisions, risks, evidence, and linked work explicit instead of inferring
                implementation or ownership.
              </p>
            </div>
          </div>
          <label className="field-label" htmlFor="planning-direction">
            Candidate direction
            <textarea
              id="planning-direction"
              rows={3}
              value={
                stringValue(values.planning, "candidate_direction") ||
                stringValue(values.planning, "core_worker_fantasy")
              }
              onChange={(event) =>
                updateSection("planning", "candidate_direction", event.target.value)
              }
            />
          </label>
          <div className="studio-field-grid">
            <label className="field-label" htmlFor="planning-decision">
              Decision
              <input
                id="planning-decision"
                value={stringValue(values.planning, "decision")}
                onChange={(event) => updateSection("planning", "decision", event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="planning-evidence">
              Evidence
              <input
                id="planning-evidence"
                value={stringValue(values.planning, "evidence")}
                onChange={(event) => updateSection("planning", "evidence", event.target.value)}
              />
            </label>
          </div>
          <label className="field-label" htmlFor="planning-risks">
            Risks and open questions
            <textarea
              id="planning-risks"
              rows={3}
              value={stringValue(values.planning, "risks")}
              onChange={(event) => updateSection("planning", "risks", event.target.value)}
            />
          </label>
          {linkedRecords.length ? (
            <div className="linked-records">
              <strong>Linked Pokémon</strong>
              <div>
                {linkedRecords.map((linked) => (
                  <a href={`/studio/pokemon/${linked.slug}`} key={linked.publicId}>
                    {linked.nationalDex ? `#${String(linked.nationalDex).padStart(3, "0")}` : ""}{" "}
                    {linked.displayName}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="editor-section private-section" aria-labelledby="notes-heading">
          <div className="editor-section-heading">
            <span>07</span>
            <div>
              <h2 id="notes-heading">
                <LockKey aria-hidden="true" /> Private notes &amp; comments
              </h2>
              <p>Internal collaboration only; these fields never enter a publication bundle.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="private-note">
            Maintainer note
            <textarea
              id="private-note"
              rows={4}
              value={values.privateNote}
              onChange={(event) => updatePrivateNote(event.target.value)}
            />
          </label>
          <div className="comment-composer">
            <label className="field-label" htmlFor="comment">
              New private comment
              <textarea
                id="comment"
                rows={3}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void submitComment()}
            >
              <ChatCircleText aria-hidden="true" /> Add comment
            </button>
          </div>
          {comments.length ? (
            <ol className="comment-list">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <strong>{comment.author}</strong>
                  <span>{comment.body}</span>
                  <small>{comment.createdAt.slice(0, 10)}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="fine-print">
              No comments yet. Keep discussion linked to the record instead of inferring ownership.
            </p>
          )}
        </section>
      </section>

      <aside className="editor-inspector" aria-label="Record inspector">
        <section className="inspector-block sticky-save">
          <div className="inspector-title">
            <h2>
              <FloppyDisk aria-hidden="true" /> Save state
            </h2>
            <StatusLamp tone={statusTone(saveState)} label={statusLabel(saveState)} />
          </div>
          <p className="fine-print" aria-live="polite">
            {message}
          </p>
        </section>
        <section className="inspector-block">
          <div className="inspector-title">
            <h2>
              <ClipboardText aria-hidden="true" /> Linked work
            </h2>
            <span className="count-badge">{record.workItems.length}</span>
          </div>
          {record.workItems.map((item) => (
            <div className="work-link" key={item.publicId}>
              <strong>{item.title}</strong>
              <small>
                {item.status} ·{" "}
                {item.assignees.length
                  ? item.assignees.map((person) => person.displayName).join(", ")
                  : "unassigned"}
              </small>
            </div>
          ))}
        </section>
        <section className="inspector-block">
          <div className="inspector-title">
            <h2>
              <Flask aria-hidden="true" /> Revision history
            </h2>
            <span className="count-badge">{record.revisions.length}</span>
          </div>
          <ol className="revision-list">
            {record.revisions.slice(0, 8).map((revision) => (
              <li key={`${revision.revision}-${revision.at}`}>
                <span>r{revision.revision}</span>
                <div>
                  <strong>{revision.summary}</strong>
                  <small>
                    {revision.actor} · {revision.at.slice(0, 10)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </section>
        {conflict ? (
          <section className="inspector-block conflict-block">
            <div className="inspector-title">
              <h2>
                <WarningCircle aria-hidden="true" /> Remote revision
              </h2>
            </div>
            <p>
              A newer revision is r{conflict.revision}. Your unsaved structured edits are still
              local.
            </p>
            <div className="button-row">
              <button className="button button-secondary" type="button" onClick={refreshConflict}>
                <ArrowClockwise aria-hidden="true" /> Refresh
              </button>
              <button className="button button-primary" type="button" onClick={continueFromRemote}>
                Continue from r{conflict.revision}
              </button>
            </div>
          </section>
        ) : null}
        <section className="inspector-block publication-block">
          <p className="eyebrow">Publication gate</p>
          <h2>Approve exact revision</h2>
          <p className="fine-print">
            Approval freezes this record’s current immutable revision. Git review remains the
            publication gate.
          </p>
          <button
            className="button button-primary"
            disabled={
              saveState === "dirty" || saveState === "saving" || record.workflowState === "approved"
            }
            type="button"
            onClick={() => void approve()}
          >
            <CheckCircle aria-hidden="true" />{" "}
            {record.workflowState === "approved"
              ? "Approved"
              : `Approve revision ${record.revision}`}
          </button>
        </section>
      </aside>
    </div>
  );
}

/** @deprecated Use StudioRecordWorkspace for non-Pokémon Studio records. */
export const PokemonWorkspace = StudioRecordWorkspace;
