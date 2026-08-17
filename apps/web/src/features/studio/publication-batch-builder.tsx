"use client";

import { CheckSquare, DownloadSimple, Package, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RegistryId, StatusLamp } from "@/components/ui";
import type { StudioRecord } from "@/data/studio-types";
import { createStudioPublicationBatch } from "@/server/studio-beta-actions";

export function PublicationBatchBuilder({
  approvedRecords,
  fixtureMode,
}: {
  approvedRecords: StudioRecord[];
  fixtureMode: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(publicId: string) {
    setPublicationId("");
    setMessage("");
    setSelected((current) =>
      current.includes(publicId)
        ? current.filter((entry) => entry !== publicId)
        : [...current, publicId],
    );
  }

  async function createBatch() {
    if (!selected.length || pending) return;
    setPending(true);
    setMessage("");
    setPublicationId("");
    try {
      const result = await createStudioPublicationBatch(selected);
      if (result.ok) {
        setPublicationId(result.publicationId);
        setMessage("The immutable bundle is ready for deterministic local export and Git review.");
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("The publication batch could not be created. No record was published.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="publication-builder material-panel" aria-labelledby="batch-builder-title">
      <div className="publication-builder-heading">
        <div>
          <p className="eyebrow">
            <Package aria-hidden="true" /> Freeze approved heads
          </p>
          <h2 id="batch-builder-title">Create a publication batch</h2>
          <p className="fine-print">
            Select approved records. Required job and machine dependencies are added automatically
            at their exact approved revisions.
          </p>
        </div>
        <StatusLamp
          tone={fixtureMode ? "amber" : "teal"}
          label={fixtureMode ? "Fixture mode" : `${approvedRecords.length} approved`}
        />
      </div>

      {approvedRecords.length ? (
        <fieldset className="publication-records">
          <legend>Approved records</legend>
          {approvedRecords.map((record) => (
            <label key={record.publicId} className="publication-record-option">
              <input
                type="checkbox"
                checked={selectedSet.has(record.publicId)}
                onChange={() => toggle(record.publicId)}
              />
              <span>
                <strong>{record.displayName}</strong>
                <RegistryId>{record.publicId}</RegistryId>
              </span>
              <small>{record.recordKind.replaceAll("_", " ")}</small>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="callout callout-warning">
          <WarningCircle aria-hidden="true" /> No record is ready to freeze yet. Approve an exact
          current revision from its workspace first.
        </p>
      )}

      <div className="publication-builder-actions">
        <button
          className="button button-primary"
          disabled={!selected.length || pending || fixtureMode}
          type="button"
          onClick={() => void createBatch()}
        >
          <CheckSquare aria-hidden="true" />
          {pending ? "Freezing approved revisions…" : `Create batch (${selected.length})`}
        </button>
        {publicationId ? (
          <Link
            className="button button-secondary"
            href={`/studio/publications?batch=${encodeURIComponent(publicationId)}`}
          >
            <DownloadSimple aria-hidden="true" /> Open bundle and Git gate
          </Link>
        ) : null}
      </div>
      {fixtureMode ? (
        <p className="source-note">
          Fixture mode intentionally proves the user interface only; it cannot freeze or publish a
          database-backed batch.
        </p>
      ) : null}
      {message ? (
        <p className="publication-builder-message" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
