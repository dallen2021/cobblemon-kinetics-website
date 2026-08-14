"use client";

import { useEffect, useRef, useState } from "react";
import type { SquirtleDraft } from "@/data/types";
import { EfficiencyGauge, ItemSlot, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import {
  approveSquirtleDraft,
  createSquirtlePublicationBatch,
  saveSquirtleDraft,
  type SaveDraftInput,
  type SaveDraftResult,
} from "@/server/studio-actions";
import { validateSquirtleEditor, type SquirtleEditorValues } from "./validation";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

interface PendingAutosave {
  values: SquirtleEditorValues;
  serialized: string;
  expectedRevision?: number;
}

function statusTone(state: SaveState): "green" | "amber" | "red" | "teal" {
  if (state === "saved") return "green";
  if (state === "error" || state === "conflict") return "red";
  if (state === "saving" || state === "dirty") return "amber";
  return "teal";
}

function statusLabel(state: SaveState): string {
  return {
    idle: "Ready",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
    conflict: "Revision conflict",
  }[state];
}

export function SquirtleEditor({
  initialRecord,
  fixtureMode,
}: {
  initialRecord: SquirtleDraft;
  fixtureMode: boolean;
}) {
  const [record, setRecord] = useState(initialRecord);
  const [values, setValues] = useState<SquirtleEditorValues>({
    machineId: initialRecord.machineId,
    jobId: initialRecord.jobId,
    efficiency: initialRecord.efficiency,
    publicRationale: initialRecord.publicRationale,
    privateNote: initialRecord.privateNote,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<SquirtleDraft | null>(null);
  const [showPublication, setShowPublication] = useState(
    initialRecord.workflowState === "approved",
  );
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [publicationMessage, setPublicationMessage] = useState("");
  const [requestPending, setRequestPending] = useState(false);
  const lastSaved = useRef(JSON.stringify(values));
  const valuesRef = useRef(values);
  const revisionRef = useRef(record.revision);
  const requestInFlight = useRef(false);
  const queuedAutosave = useRef<PendingAutosave | null>(null);
  const issues = validateSquirtleEditor(values);
  const valid = issues.length === 0;

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  function update<Key extends keyof SquirtleEditorValues>(
    key: Key,
    value: SquirtleEditorValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaveState("dirty");
    setMessage("");
    setShowPublication(false);
    setPublicationId(null);
    setPublicationMessage("");
  }

  function inputFor(
    snapshot: SquirtleEditorValues,
    expectedRevision = revisionRef.current,
  ): SaveDraftInput {
    return { ...snapshot, expectedRevision, clientMutationId: crypto.randomUUID() };
  }

  function handleResult(result: SaveDraftResult, serialized: string): boolean {
    if (result.ok) {
      revisionRef.current = result.record.revision;
      setRecord((current) => {
        const revisions = [...result.record.revisions, ...current.revisions].filter(
          (revision, index, all) =>
            all.findIndex((candidate) => candidate.revision === revision.revision) === index,
        );
        return { ...result.record, revisions };
      });
      lastSaved.current = serialized;
      setConflict(null);
      if (JSON.stringify(valuesRef.current) === serialized) {
        setSaveState("saved");
        setMessage(`Revision ${result.record.revision} saved by ${result.record.updatedBy}.`);
      } else {
        setSaveState("dirty");
        setMessage(`Revision ${result.record.revision} saved. Newer changes are queued.`);
      }
      return true;
    }
    if (result.kind === "conflict") {
      setConflict(result.current);
      setSaveState("conflict");
      setMessage(
        "A newer server revision exists. Compare it before choosing which version to continue from.",
      );
    } else if (result.kind === "validation") {
      setSaveState("error");
      setMessage(result.messages.join(" "));
    } else {
      setSaveState("error");
      setMessage(result.message);
    }
    return false;
  }

  async function enqueueAutosave(pending: PendingAutosave): Promise<void> {
    queuedAutosave.current = pending;
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setRequestPending(true);
    try {
      while (queuedAutosave.current) {
        const next = queuedAutosave.current;
        queuedAutosave.current = null;
        if (next.serialized === lastSaved.current) continue;
        setSaveState("saving");
        const result = await saveSquirtleDraft(inputFor(next.values, next.expectedRevision));
        if (!handleResult(result, next.serialized)) {
          queuedAutosave.current = null;
          break;
        }
      }
    } catch {
      queuedAutosave.current = null;
      setSaveState("error");
      setMessage("The draft could not be saved. No fields were overwritten.");
    } finally {
      requestInFlight.current = false;
      setRequestPending(false);
    }
  }

  useEffect(() => {
    const serialized = JSON.stringify(values);
    if (serialized === lastSaved.current || !valid || conflict) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      void enqueueAutosave({ values: { ...values }, serialized });
    }, 800);
    return () => window.clearTimeout(timer);
    // The queue and revision use refs so an edit during a request cannot start
    // another request or save against a stale revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, valid, conflict]);

  function loadCurrent() {
    if (!conflict) return;
    const nextValues = {
      machineId: conflict.machineId,
      jobId: conflict.jobId,
      efficiency: conflict.efficiency,
      publicRationale: conflict.publicRationale,
      privateNote: conflict.privateNote,
    };
    setRecord(conflict);
    revisionRef.current = conflict.revision;
    setValues(nextValues);
    lastSaved.current = JSON.stringify(nextValues);
    setConflict(null);
    setSaveState("idle");
    setMessage("Loaded the current server revision.");
  }

  function retryMine() {
    if (!conflict) return;
    const expectedRevision = conflict.revision;
    const serialized = JSON.stringify(values);
    setRecord(conflict);
    revisionRef.current = expectedRevision;
    setConflict(null);
    void enqueueAutosave({
      values: { ...values },
      serialized,
      expectedRevision,
    });
  }

  async function approve() {
    if (!valid || saveState === "dirty" || saveState === "saving" || requestInFlight.current)
      return;
    const serialized = JSON.stringify(values);
    requestInFlight.current = true;
    setRequestPending(true);
    setSaveState("saving");
    try {
      const result = await approveSquirtleDraft(inputFor({ ...values }));
      const succeeded = handleResult(result, serialized);
      if (result.ok) setShowPublication(true);
      if (!succeeded) queuedAutosave.current = null;
    } catch {
      queuedAutosave.current = null;
      setSaveState("error");
      setMessage("Approval failed without changing the record.");
    } finally {
      requestInFlight.current = false;
      setRequestPending(false);
      const queued = queuedAutosave.current;
      queuedAutosave.current = null;
      if (queued) void enqueueAutosave(queued);
    }
  }

  async function freezePublicationBatch() {
    if (
      record.workflowState !== "approved" ||
      requestInFlight.current ||
      saveState === "dirty" ||
      saveState === "saving"
    )
      return;
    requestInFlight.current = true;
    setRequestPending(true);
    setPublicationMessage("Freezing the approved revision…");
    try {
      const result = await createSquirtlePublicationBatch(inputFor({ ...values }, record.revision));
      if (result.ok) {
        setPublicationId(result.publicationId);
        setPublicationMessage("Immutable publication batch ready for download.");
      } else {
        setPublicationMessage(result.message);
      }
    } catch {
      setPublicationMessage("The publication batch could not be created.");
    } finally {
      requestInFlight.current = false;
      setRequestPending(false);
    }
  }

  function simulateConflict() {
    if (!fixtureMode) return;
    setConflict({
      ...record,
      revision: record.revision + 1,
      publicRationale: `${record.publicRationale} Server-side fixture change.`,
    });
    setSaveState("conflict");
    setMessage("Fixture conflict created for interface testing.");
  }

  return (
    <div className="editor-layout">
      <section className="editor-canvas" aria-labelledby="editor-title">
        <header className="record-header">
          <div className="record-token" aria-hidden="true">
            007
          </div>
          <div>
            <p className="eyebrow">Worker record · Revision {record.revision}</p>
            <h1 id="editor-title">Squirtle</h1>
            <div className="chip-row">
              <TypeChip type="Water" />
              <StatusLamp
                tone={record.workflowState === "approved" ? "green" : "amber"}
                label={record.workflowState.replace("_", " ")}
              />
            </div>
          </div>
          <RegistryId>cobblemon:squirtle</RegistryId>
        </header>

        <div className="editor-section">
          <div className="editor-section-heading">
            <span>01</span>
            <div>
              <h2>Work assignment</h2>
              <p>One explicit job and one exact workstation identity.</p>
            </div>
          </div>
          <fieldset className="machine-picker">
            <legend>Machine</legend>
            <label
              className={
                values.machineId === "cobblemon_kinetics:hydro_coupler"
                  ? "machine-option-selected"
                  : ""
              }
            >
              <input
                type="radio"
                name="machine"
                value="cobblemon_kinetics:hydro_coupler"
                checked={values.machineId === "cobblemon_kinetics:hydro_coupler"}
                onChange={(event) => update("machineId", event.target.value)}
              />
              <ItemSlot
                active={values.machineId === "cobblemon_kinetics:hydro_coupler"}
                label="Hydro Coupler"
                registryId="cobblemon_kinetics:hydro_coupler"
              />
              <span className="option-detail">Kinetic source · versioned registry binding</span>
            </label>
          </fieldset>
          <label className="field-label" htmlFor="job-id">
            Job profile<span>Required</span>
          </label>
          <select
            id="job-id"
            value={values.jobId}
            onChange={(event) => update("jobId", event.target.value)}
          >
            <option value="cobblemon_kinetics:hydro_operator">Hydro Operator</option>
          </select>
        </div>

        <div className="editor-section">
          <div className="editor-section-heading">
            <span>02</span>
            <div>
              <h2>Balance</h2>
              <p>Public values must be explainable and bounded.</p>
            </div>
          </div>
          <div className="balance-row">
            <div>
              <label className="field-label" htmlFor="efficiency">
                Efficiency multiplier<span>0.25×–2.00×</span>
              </label>
              <input
                id="efficiency"
                type="number"
                min="0.25"
                max="2"
                step="0.05"
                value={values.efficiency}
                onChange={(event) => update("efficiency", event.target.valueAsNumber)}
                aria-describedby="efficiency-help"
              />
              <small id="efficiency-help">1.00× is the neutral Hydro prototype baseline.</small>
            </div>
            <EfficiencyGauge value={Number.isFinite(values.efficiency) ? values.efficiency : 0} />
          </div>
          <label className="field-label" htmlFor="public-rationale">
            Public balance rationale<span>{values.publicRationale.trim().length} characters</span>
          </label>
          <textarea
            id="public-rationale"
            rows={5}
            value={values.publicRationale}
            onChange={(event) => update("publicRationale", event.target.value)}
          />
        </div>

        <div className="editor-section private-section">
          <div className="editor-section-heading">
            <span>03</span>
            <div>
              <h2>Private design note</h2>
              <p>Internal collaboration only. Never included in public projection or export.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="private-note">
            Maintainer note<span>{values.privateNote.length}/2,000</span>
          </label>
          <textarea
            id="private-note"
            rows={5}
            value={values.privateNote}
            onChange={(event) => update("privateNote", event.target.value)}
          />
          <p className="privacy-line">
            <span aria-hidden="true">◆</span> Excluded from publication bundles by schema.
          </p>
        </div>
      </section>

      <aside className="editor-inspector" aria-label="Record inspector">
        <section className="inspector-block sticky-save">
          <div className="inspector-title">
            <h2>Save state</h2>
            <StatusLamp tone={statusTone(saveState)} label={statusLabel(saveState)} />
          </div>
          <p className="fine-print" aria-live="polite">
            {message || "Valid changes save after 800 ms of inactivity."}
          </p>
          {requestPending ? (
            <div className="thin-progress" aria-hidden="true">
              <span />
            </div>
          ) : null}
        </section>

        <section className="inspector-block">
          <div className="inspector-title">
            <h2>Validation</h2>
            <span className={`count-badge ${valid ? "count-valid" : ""}`}>{issues.length}</span>
          </div>
          {valid ? (
            <p className="validation-pass">✓ All required Hydro fields pass.</p>
          ) : (
            <ul className="validation-list">
              {issues.map((issue) => (
                <li key={`${issue.field}:${issue.message}`}>
                  <a
                    href={`#${issue.field === "machineId" ? "job-id" : issue.field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`}
                  >
                    {issue.message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {conflict ? (
          <section className="inspector-block conflict-block" role="alert">
            <p className="eyebrow">Revision conflict</p>
            <h2>Revision {conflict.revision} is already current</h2>
            <dl className="conflict-comparison">
              <div>
                <dt>Your efficiency</dt>
                <dd>{values.efficiency.toFixed(2)}×</dd>
              </div>
              <div>
                <dt>Server efficiency</dt>
                <dd>{conflict.efficiency.toFixed(2)}×</dd>
              </div>
            </dl>
            <div className="button-stack">
              <button className="button button-primary" type="button" onClick={retryMine}>
                Save mine onto revision {conflict.revision}
              </button>
              <button className="button button-secondary" type="button" onClick={loadCurrent}>
                Load server revision
              </button>
            </div>
          </section>
        ) : null}

        <section className="inspector-block">
          <div className="inspector-title">
            <h2>Revision history</h2>
            <span className="count-badge">{record.revisions.length}</span>
          </div>
          <ol className="revision-list">
            {record.revisions.slice(0, 5).map((revision) => (
              <li key={`${revision.revision}:${revision.at}`}>
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

        <section className="inspector-block publication-block">
          <p className="eyebrow">Publication gate</p>
          <h2>
            {record.workflowState === "approved" ? "Revision approved" : "Approve exact revision"}
          </h2>
          <p>
            Approval freezes public fields. It does not publish them until the deterministic export
            reaches Git main.
          </p>
          <button
            className="button button-primary button-full"
            type="button"
            onClick={() => void approve()}
            disabled={!valid || saveState === "dirty" || saveState === "saving" || requestPending}
          >
            {record.workflowState === "approved"
              ? "Re-approve current revision"
              : `Approve revision ${record.revision}`}
          </button>
          {fixtureMode ? (
            <button
              className="button button-quiet button-full"
              type="button"
              onClick={simulateConflict}
            >
              Simulate revision conflict
            </button>
          ) : null}
        </section>

        {showPublication ? (
          <section className="inspector-block publication-diff" aria-live="polite">
            <p className="eyebrow">Public projection</p>
            <h2>Ready for a batch</h2>
            <dl>
              <div>
                <dt>Machine</dt>
                <dd>{values.machineId}</dd>
              </div>
              <div>
                <dt>Efficiency</dt>
                <dd>{values.efficiency.toFixed(2)}×</dd>
              </div>
              <div>
                <dt>Rationale</dt>
                <dd>{values.publicRationale}</dd>
              </div>
              <div className="excluded-field">
                <dt>Private note</dt>
                <dd>Excluded</dd>
              </div>
            </dl>
            {publicationId ? (
              <div className="button-stack">
                <a
                  className="button button-secondary button-full"
                  href={`/api/publications/${publicationId}/bundle`}
                >
                  Download frozen bundle
                </a>
                <a
                  className="button button-quiet button-full"
                  href={`/studio/publications?batch=${encodeURIComponent(publicationId)}`}
                >
                  Continue to Git verification
                </a>
              </div>
            ) : (
              <button
                className="button button-secondary button-full"
                type="button"
                onClick={() => void freezePublicationBatch()}
                disabled={requestPending}
              >
                Create immutable publication batch
              </button>
            )}
            <p className="fine-print" aria-live="polite">
              {publicationMessage ||
                "Create a batch to freeze this exact approved revision before download."}
            </p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
