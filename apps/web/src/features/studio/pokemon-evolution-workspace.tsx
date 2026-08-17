"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowClockwise,
  CheckCircle,
  ChatCircleText,
  ClipboardText,
  ClockCounterClockwise,
  Flask,
  FloppyDisk,
  Gauge,
  Gear,
  Graph,
  Leaf,
  LockKey,
  PawPrint,
  ShieldCheck,
  Sparkle,
  TreeStructure,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import type {
  BlueprintLibraryItem,
  FamilyBlueprint,
  PokemonWorkspaceData,
  PokemonWorkspaceTab,
  StudioComment,
  StudioObject,
} from "@/data/studio-types";
import {
  addStudioComment,
  approveStudioRecord,
  checkStudioRecordHead,
  saveBlueprintView,
  saveStudioRecord,
} from "@/server/studio-beta-actions";

const KineticBlueprint = dynamic(
  () => import("./kinetic-blueprint").then((module) => module.KineticBlueprint),
  {
    ssr: false,
    loading: () => (
      <div className="blueprint-loading" role="status">
        <Graph aria-hidden="true" /> Preparing the family schematic…
      </div>
    ),
  },
);

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

const tabs: Array<{
  id: PokemonWorkspaceTab;
  label: string;
  icon: typeof PawPrint;
}> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "blueprint", label: "Blueprint", icon: Graph },
  { id: "facts", label: "Facts", icon: ClipboardText },
  { id: "discussion", label: "Discussion & History", icon: ChatCircleText },
];

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

function stableSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

function valuesFrom(workspace: PokemonWorkspaceData): EditorValues {
  const facts = { ...workspace.facts };
  for (const key of ["growth_rate", "habitat", "shape", "color"] as const) {
    if (typeof facts[key] === "string") facts[key] = stableSlug(String(facts[key]));
  }
  facts.primary_type = stringValue(facts, "primary_type") || workspace.types[0] || "normal";
  facts.secondary_type = stringValue(facts, "secondary_type") || workspace.types[1] || "";
  return {
    facts,
    design: { ...workspace.design },
    work: { ...workspace.work },
    balance: { ...workspace.balance },
    testing: { ...workspace.testing },
    planning: { ...workspace.planning },
    privateNote: workspace.privateNote,
  };
}

function serialize(values: EditorValues): string {
  return JSON.stringify(values);
}

function saveTone(state: SaveState): "green" | "amber" | "red" | "teal" {
  if (state === "saved") return "green";
  if (state === "dirty" || state === "saving") return "amber";
  if (state === "conflict" || state === "error") return "red";
  return "teal";
}

function saveLabel(state: SaveState): string {
  return {
    ready: "Ready",
    dirty: "Unsaved",
    saving: "Saving…",
    saved: "Saved",
    conflict: "Remote update",
    error: "Save failed",
  }[state];
}

function tabFromPreference(preferred: PokemonWorkspaceData["preferredView"]): PokemonWorkspaceTab {
  if (preferred === "facts") return "facts";
  if (preferred === "discussion") return "discussion";
  if (preferred === "canvas" || preferred === "outline") return "blueprint";
  return "overview";
}

function sourceFor(workspace: PokemonWorkspaceData, field: string) {
  return workspace.provenance.find(
    (entry) => entry.fieldPath === `facts.${field}` || entry.fieldPath === field,
  );
}

function completionPercent(workspace: PokemonWorkspaceData, values: EditorValues): number {
  const checks = [
    stringValue(values.facts, "genus"),
    stringValue(values.facts, "habitat"),
    stringValue(values.facts, "growth_rate"),
    stringValue(values.facts, "shape"),
    stringValue(values.facts, "color"),
    workspace.capabilities.length,
    stringValue(values.design, "candidate_job"),
    stringValue(values.balance, "public_rationale"),
    stringValue(values.testing, "scenario"),
    workspace.workItems.length,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function PokemonEvolutionWorkspace({
  initialWorkspace,
  initialBlueprint,
  library,
}: {
  initialWorkspace: PokemonWorkspaceData;
  initialBlueprint: FamilyBlueprint;
  library: BlueprintLibraryItem[];
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [blueprint, setBlueprint] = useState(initialBlueprint);
  const [values, setValues] = useState<EditorValues>(() => valuesFrom(initialWorkspace));
  const [activeTab, setActiveTab] = useState<PokemonWorkspaceTab>(() =>
    tabFromPreference(initialWorkspace.preferredView),
  );
  const [saveState, setSaveState] = useState<SaveState>("ready");
  const [message, setMessage] = useState("Valid fact and planning changes save after 800 ms.");
  const [remoteWorkspace, setRemoteWorkspace] = useState<PokemonWorkspaceData | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [comments, setComments] = useState<StudioComment[]>(initialWorkspace.comments);
  const [isApproving, startApproval] = useTransition();
  const revisionRef = useRef(initialWorkspace.revision);
  const valuesRef = useRef(values);
  const lastSavedRef = useRef(serialize(values));
  const requestInFlightRef = useRef(false);
  const queuedRef = useRef<EditorValues | null>(null);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void checkStudioRecordHead(workspace.publicId)
        .then((head) => {
          if (head.revision !== revisionRef.current) {
            setSaveState("conflict");
            setMessage(
              `A maintainer saved revision ${head.revision}. Your local fields remain intact.`,
            );
          }
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [workspace.publicId]);

  function updateSection(
    section: keyof Omit<EditorValues, "privateNote">,
    key: string,
    value: string | number,
  ): void {
    setValues((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
    setSaveState("dirty");
    setMessage("");
  }

  function updatePrivateNote(value: string): void {
    setValues((current) => ({ ...current, privateNote: value }));
    setSaveState("dirty");
    setMessage("");
  }

  const performSave = useCallback(
    async (next: EditorValues): Promise<boolean> => {
      const result = await saveStudioRecord({
        publicId: workspace.publicId,
        expectedRevision: revisionRef.current,
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
          setRemoteWorkspace({ ...workspace, ...result.current });
          setSaveState("conflict");
          setMessage(`Another maintainer saved revision ${result.current.revision}.`);
        } else {
          setSaveState("error");
          setMessage(result.message);
        }
        return false;
      }
      revisionRef.current = result.record.revision;
      setWorkspace((current) => ({
        ...current,
        ...result.record,
        revisions: [
          {
            revision: result.record.revision,
            actor: result.record.updatedBy,
            at: result.record.updatedAt,
            summary: "Saved Pokémon workspace fields.",
          },
          ...current.revisions.filter((revision) => revision.revision !== result.record.revision),
        ],
      }));
      lastSavedRef.current = serialize(next);
      if (serialize(valuesRef.current) === serialize(next)) {
        setSaveState("saved");
        setMessage(`Revision ${result.record.revision} saved.`);
      } else {
        setSaveState("dirty");
        setMessage(`Revision ${result.record.revision} saved; newer fields are queued.`);
      }
      return true;
    },
    [workspace],
  );

  const drainAutosave = useCallback(
    async (initial: EditorValues): Promise<void> => {
      queuedRef.current = initial;
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      try {
        while (queuedRef.current) {
          const next = queuedRef.current;
          queuedRef.current = null;
          if (serialize(next) === lastSavedRef.current) continue;
          setSaveState("saving");
          if (!(await performSave(next))) {
            queuedRef.current = null;
            break;
          }
        }
      } finally {
        requestInFlightRef.current = false;
      }
    },
    [performSave],
  );

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void drainAutosave(values), 800);
    return () => window.clearTimeout(timer);
  }, [drainAutosave, saveState, values]);

  function changeTab(tab: PokemonWorkspaceTab): void {
    setActiveTab(tab);
    const lastView =
      tab === "blueprint"
        ? blueprint.preference.lastView === "outline"
          ? "outline"
          : "canvas"
        : tab;
    void saveBlueprintView({
      boardPublicId: blueprint.board.publicId,
      viewport: blueprint.preference.viewport,
      filters: { ...blueprint.preference.filters, last_view: lastView },
      hiddenNodes: blueprint.preference.hiddenNodes,
    }).catch(() => undefined);
  }

  function refreshFromRemote(): void {
    if (!remoteWorkspace) {
      window.location.reload();
      return;
    }
    revisionRef.current = remoteWorkspace.revision;
    const next = valuesFrom(remoteWorkspace);
    setWorkspace(remoteWorkspace);
    setValues(next);
    valuesRef.current = next;
    lastSavedRef.current = serialize(next);
    setRemoteWorkspace(null);
    setSaveState("ready");
    setMessage(`Loaded revision ${remoteWorkspace.revision}.`);
  }

  function continueFromRemote(): void {
    if (!remoteWorkspace) return;
    revisionRef.current = remoteWorkspace.revision;
    setWorkspace((current) => ({ ...current, ...remoteWorkspace }));
    setRemoteWorkspace(null);
    setSaveState("dirty");
    setMessage(`Rebased local fields onto revision ${remoteWorkspace.revision}; saving next.`);
  }

  async function submitComment(): Promise<void> {
    if (!commentBody.trim()) return;
    try {
      const comment = await addStudioComment(workspace.publicId, commentBody);
      setComments((current) => [...current, comment]);
      setCommentBody("");
    } catch {
      setMessage("The private comment could not be saved.");
    }
  }

  function approve(): void {
    startApproval(async () => {
      const result = await approveStudioRecord(workspace.publicId, revisionRef.current);
      if (!result.ok) {
        if (result.kind === "conflict") setRemoteWorkspace({ ...workspace, ...result.current });
        setMessage(
          result.kind === "validation" || result.kind === "error"
            ? result.message
            : "A newer revision must be reviewed first.",
        );
        return;
      }
      setWorkspace((current) => ({ ...current, ...result.record }));
      setMessage(`Revision ${result.record.revision} approved exactly.`);
    });
  }

  const currentFormId =
    workspace.family.members.find((member) => member.publicId === workspace.publicId)
      ?.formPublicId ?? `${workspace.publicId}/default`;
  const nodeNames = useMemo(
    () => new Map(blueprint.nodes.map((node) => [node.id, node.displayName])),
    [blueprint.nodes],
  );
  const jobs = blueprint.edges
    .filter((edge) => edge.source === currentFormId && edge.relationshipKind === "assigned_to_job")
    .map((edge) => ({ edge, name: nodeNames.get(edge.target) ?? edge.target }));
  const completion = completionPercent(workspace, values);
  const genus = stringValue(values.facts, "genus");
  const genusKnown = (workspace.controlledValues.genus ?? []).some(
    (option) => option.slug === stableSlug(genus),
  );

  return (
    <div className="editor-layout evolution-workspace">
      <section className="editor-canvas" aria-labelledby="pokemon-workspace-title">
        <header className="record-header evolution-record-header">
          <div
            className="record-token worker-record-token"
            aria-label={`National Dex ${workspace.nationalDex}`}
          >
            {String(workspace.nationalDex).padStart(3, "0")}
          </div>
          <div>
            <p className="eyebrow">
              Gen 1 worker · {workspace.family.stage.label} · Revision {workspace.revision}
            </p>
            <h1 id="pokemon-workspace-title">{workspace.displayName}</h1>
            <div className="chip-row">
              {workspace.types.map((type) => (
                <TypeChip type={type} key={type} />
              ))}
              <StatusLamp
                tone={workspace.workflowState === "approved" ? "green" : "amber"}
                label={workspace.workflowState.replaceAll("_", " ")}
              />
            </div>
          </div>
          <RegistryId>{workspace.cobblemonSpeciesId ?? workspace.publicId}</RegistryId>
        </header>

        <nav
          className="pokemon-workspace-tabs"
          aria-label="Pokémon workspace sections"
          role="tablist"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`pokemon-tab-${id}`}
              type="button"
              aria-controls={`pokemon-panel-${id}`}
              aria-selected={activeTab === id}
              role="tab"
              onClick={() => changeTab(id)}
            >
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" ? (
          <div
            id="pokemon-panel-overview"
            className="pokemon-overview"
            aria-labelledby="pokemon-tab-overview"
            role="tabpanel"
          >
            <section className="evolution-ribbon" aria-labelledby="evolution-ribbon-title">
              <header>
                <div>
                  <p className="eyebrow">Family progression</p>
                  <h2 id="evolution-ribbon-title">
                    <TreeStructure aria-hidden="true" /> {workspace.family.displayName}
                  </h2>
                </div>
                <span>Facts stay individual; capabilities require review.</span>
              </header>
              <ol>
                {workspace.family.members.map((member, index) => (
                  <li key={member.publicId} data-current={member.publicId === workspace.publicId}>
                    {index ? (
                      <span className="evolution-ribbon-connector" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                    <Link href={`/studio/pokemon/${member.publicId.split("/").at(-1)}`}>
                      <span className="record-token">
                        {String(member.nationalDex).padStart(3, "0")}
                      </span>
                      <strong>{member.displayName}</strong>
                      <small>{member.stageLabel}</small>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>

            <div className="overview-metrics">
              <article>
                <Gauge aria-hidden="true" />
                <strong>{completion}%</strong>
                <span>Design completion</span>
                <progress max={100} value={completion}>
                  {completion}%
                </progress>
              </article>
              <article>
                <Gear aria-hidden="true" />
                <strong>{workspace.capabilities.length}</strong>
                <span>Explicit capabilities</span>
              </article>
              <article>
                <Wrench aria-hidden="true" />
                <strong>{jobs.length}</strong>
                <span>Candidate jobs</span>
              </article>
              <article>
                <ClipboardText aria-hidden="true" />
                <strong>{workspace.workItems.length}</strong>
                <span>Linked tasks</span>
              </article>
            </div>

            <div className="overview-card-grid">
              <section className="overview-card">
                <header>
                  <Gear aria-hidden="true" />
                  <h2>Capabilities</h2>
                </header>
                {workspace.capabilities.length ? (
                  <ul className="capability-summary-list">
                    {workspace.capabilities.map((capability) => (
                      <li
                        key={capability.relationshipPublicId}
                        data-outdated={capability.inheritanceState === "outdated"}
                      >
                        <div>
                          <strong>{capability.name}</strong>
                          <span>
                            Tier {capability.tier} — {capability.tierLabel}
                          </span>
                        </div>
                        <StatusLamp
                          tone={capability.inheritanceState === "outdated" ? "red" : "teal"}
                          label={
                            capability.inheritanceDecision
                              ? titleCase(capability.inheritanceDecision)
                              : "Explicit"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No capability has been explicitly accepted for this form.</p>
                )}
                {workspace.typeSuggestions.map((suggestion) => (
                  <div
                    className="ghost-suggestion"
                    key={suggestion.id}
                    data-accepted={suggestion.accepted}
                  >
                    <Sparkle aria-hidden="true" />
                    <div>
                      <strong>
                        {suggestion.accepted ? "Accepted" : "Suggested"}: {suggestion.name}
                      </strong>
                      <p>{suggestion.rationale}</p>
                    </div>
                    <span>
                      {suggestion.accepted ? "Active for this form" : "Ghosted · not active"}
                    </span>
                  </div>
                ))}
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => changeTab("blueprint")}
                >
                  Open Blueprint
                </button>
              </section>

              <section className="overview-card">
                <header>
                  <Wrench aria-hidden="true" />
                  <h2>Jobs &amp; balance</h2>
                </header>
                {jobs.length ? (
                  <ul>
                    {jobs.map(({ edge, name }) => (
                      <li key={edge.id}>
                        <strong>{name}</strong>
                        <span>
                          {edge.inheritanceDecision
                            ? titleCase(edge.inheritanceDecision)
                            : "Explicit draft"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No job assignment is implied. Connect one explicitly in the Blueprint.</p>
                )}
                <label className="field-label">
                  Work readiness
                  <select
                    value={stringValue(values.work, "readiness") || "not_started"}
                    onChange={(event) => updateSection("work", "readiness", event.target.value)}
                  >
                    <option value="not_started">Not started</option>
                    <option value="candidate">Candidate</option>
                    <option value="prototype">Prototype</option>
                    <option value="tested">Tested</option>
                  </select>
                </label>
                <label className="field-label">
                  Efficiency multiplier
                  <input
                    type="number"
                    min={0}
                    max={4}
                    step={0.05}
                    value={numberValue(values.balance, "efficiency")}
                    onChange={(event) =>
                      updateSection("balance", "efficiency", event.target.valueAsNumber)
                    }
                  />
                </label>
                <label className="field-label">
                  Public balance rationale
                  <textarea
                    rows={3}
                    value={stringValue(values.balance, "public_rationale")}
                    onChange={(event) =>
                      updateSection("balance", "public_rationale", event.target.value)
                    }
                  />
                </label>
              </section>

              <section className="overview-card">
                <header>
                  <Leaf aria-hidden="true" />
                  <h2>Design direction</h2>
                </header>
                <label className="field-label">
                  Candidate job
                  <input
                    value={stringValue(values.design, "candidate_job")}
                    onChange={(event) =>
                      updateSection("design", "candidate_job", event.target.value)
                    }
                  />
                </label>
                <label className="field-label">
                  Natural design hooks
                  <textarea
                    rows={4}
                    value={stringValue(values.design, "natural_design_hooks")}
                    onChange={(event) =>
                      updateSection("design", "natural_design_hooks", event.target.value)
                    }
                  />
                </label>
              </section>

              <section className="overview-card">
                <header>
                  <Flask aria-hidden="true" />
                  <h2>Testing</h2>
                </header>
                <label className="field-label">
                  Scenario
                  <textarea
                    rows={3}
                    value={stringValue(values.testing, "scenario")}
                    onChange={(event) => updateSection("testing", "scenario", event.target.value)}
                  />
                </label>
                <label className="field-label">
                  Evidence / result
                  <input
                    value={stringValue(values.testing, "evidence")}
                    onChange={(event) => updateSection("testing", "evidence", event.target.value)}
                  />
                </label>
              </section>

              <section className="overview-card">
                <header>
                  <ClipboardText aria-hidden="true" />
                  <h2>Tasks</h2>
                </header>
                {workspace.workItems.length ? (
                  <ul>
                    {workspace.workItems.map((item) => (
                      <li key={item.publicId}>
                        <Link href="/studio/workboard">
                          <strong>{item.title}</strong>
                          <span>
                            {item.status} ·{" "}
                            {item.assignees.length
                              ? item.assignees.map((person) => person.displayName).join(", ")
                              : "unassigned"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No task is linked yet.</p>
                )}
              </section>

              <section className="overview-card">
                <header>
                  <ClockCounterClockwise aria-hidden="true" />
                  <h2>Recent activity</h2>
                </header>
                <ol className="revision-list">
                  {workspace.revisions.slice(0, 4).map((revision) => (
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
            </div>
          </div>
        ) : null}

        {activeTab === "blueprint" ? (
          <div id="pokemon-panel-blueprint" aria-labelledby="pokemon-tab-blueprint" role="tabpanel">
            <KineticBlueprint
              initialBlueprint={blueprint}
              library={library}
              activeFormPublicId={currentFormId}
              typeSuggestions={workspace.typeSuggestions}
              onApplied={(next) => setBlueprint(next)}
            />
          </div>
        ) : null}

        {activeTab === "facts" ? (
          <section
            id="pokemon-panel-facts"
            className="pokemon-facts"
            aria-labelledby="pokemon-tab-facts"
            role="tabpanel"
          >
            <header className="section-intro">
              <p className="eyebrow">Species-specific · never inherited</p>
              <h2 id="facts-tab-heading">
                <ClipboardText aria-hidden="true" /> Structured facts
              </h2>
              <p>
                Selectors store stable slugs. Original workbook values and source rows remain
                visible beside every field.
              </p>
            </header>
            <div className="fact-editor-grid">
              <label className="fact-field">
                <span>Genus</span>
                <input
                  list="genus-values"
                  value={genus}
                  onChange={(event) => updateSection("facts", "genus", event.target.value)}
                />
                <datalist id="genus-values">
                  {(workspace.controlledValues.genus ?? []).map((option) => (
                    <option key={option.slug} value={option.label} />
                  ))}
                </datalist>
                <small>
                  {genus && !genusKnown
                    ? "New genus — saved with a review flag."
                    : "Search existing values or enter a reviewed new value."}
                </small>
                <FactSource source={sourceFor(workspace, "genus")} />
              </label>
              <ControlledSelect
                label="Growth rate"
                field="growth_rate"
                value={stringValue(values.facts, "growth_rate")}
                options={workspace.controlledValues.growth_rate ?? []}
                onChange={(value) => updateSection("facts", "growth_rate", value)}
                source={sourceFor(workspace, "growth_rate")}
              />
              <ControlledSelect
                label="Habitat"
                field="habitat"
                value={stringValue(values.facts, "habitat")}
                options={workspace.controlledValues.habitat ?? []}
                onChange={(value) => updateSection("facts", "habitat", value)}
                source={sourceFor(workspace, "habitat")}
              />
              <ControlledSelect
                label="Body shape"
                field="shape"
                value={stringValue(values.facts, "shape")}
                options={workspace.controlledValues.shape ?? []}
                onChange={(value) => updateSection("facts", "shape", value)}
                source={sourceFor(workspace, "shape")}
              />
              <ControlledSelect
                label="Color"
                field="color"
                value={stringValue(values.facts, "color")}
                options={workspace.controlledValues.color ?? []}
                onChange={(value) => updateSection("facts", "color", value)}
                source={sourceFor(workspace, "color")}
              />
              <ControlledSelect
                label="Primary type"
                field="primary_type"
                value={stringValue(values.facts, "primary_type")}
                options={workspace.controlledValues.pokemon_type ?? []}
                onChange={(value) => {
                  updateSection("facts", "primary_type", value);
                  if (value === stringValue(values.facts, "secondary_type"))
                    updateSection("facts", "secondary_type", "");
                }}
                source={sourceFor(workspace, "current_primary")}
              />
              <label className="fact-field">
                <span>Secondary type</span>
                <select
                  value={stringValue(values.facts, "secondary_type")}
                  onChange={(event) => updateSection("facts", "secondary_type", event.target.value)}
                >
                  <option value="">None</option>
                  {(workspace.controlledValues.pokemon_type ?? [])
                    .filter((option) => option.slug !== stringValue(values.facts, "primary_type"))
                    .map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.label}
                      </option>
                    ))}
                </select>
                <FactSource source={sourceFor(workspace, "current_secondary")} />
              </label>
              <label className="fact-field fact-field-readonly">
                <span>Evolution stage</span>
                <output>{workspace.family.stage.label}</output>
                <small>
                  Derived from explicit family edges; edit the family Blueprint instead.
                </small>
                <FactSource source={sourceFor(workspace, "evolution_stage")} />
              </label>
            </div>
            <details className="provenance-summary">
              <summary>All imported source fields ({workspace.provenance.length})</summary>
              <ul>
                {workspace.provenance.map((field) => (
                  <li key={field.fieldPath}>
                    <code>{field.fieldPath}</code>
                    <span>{JSON.stringify(field.importedValue)}</span>
                    <small>
                      {field.sourceSheet} row {field.sourceRow}
                      {field.overriddenAt ? " · Studio override" : " · Imported baseline"}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : null}

        {activeTab === "discussion" ? (
          <section
            id="pokemon-panel-discussion"
            className="pokemon-discussion"
            aria-labelledby="pokemon-tab-discussion"
            role="tabpanel"
          >
            <header className="section-intro">
              <p className="eyebrow">Private collaboration</p>
              <h2 id="discussion-heading">
                <ChatCircleText aria-hidden="true" /> Discussion &amp; history
              </h2>
              <p>
                Notes, comments, actor identity, and conflict details never enter public projection
                bundles.
              </p>
            </header>
            <div className="discussion-grid">
              <section className="private-section">
                <h3>
                  <LockKey aria-hidden="true" /> Maintainer note
                </h3>
                <textarea
                  rows={7}
                  value={values.privateNote}
                  onChange={(event) => updatePrivateNote(event.target.value)}
                />
                <small>Private field · maximum 10,000 characters</small>
              </section>
              <section>
                <h3>
                  <ChatCircleText aria-hidden="true" /> Record comments
                </h3>
                <label className="field-label">
                  New private comment
                  <textarea
                    rows={3}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!commentBody.trim()}
                  onClick={() => void submitComment()}
                >
                  <ChatCircleText aria-hidden="true" /> Add comment
                </button>
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
                  <p>No comments yet.</p>
                )}
              </section>
              <section>
                <h3>
                  <ClockCounterClockwise aria-hidden="true" /> Immutable revisions
                </h3>
                <ol className="revision-list">
                  {workspace.revisions.map((revision) => (
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
              <section className="publication-block">
                <p className="eyebrow">Publication gate</p>
                <h3>
                  <ShieldCheck aria-hidden="true" /> Approve exact revision
                </h3>
                <p>
                  Approval freezes this exact record revision. Graph dependencies retain their own
                  review state.
                </p>
                <button
                  className="button button-primary"
                  disabled={
                    saveState === "dirty" ||
                    saveState === "saving" ||
                    workspace.workflowState === "approved" ||
                    isApproving
                  }
                  type="button"
                  onClick={approve}
                >
                  <CheckCircle aria-hidden="true" />{" "}
                  {workspace.workflowState === "approved"
                    ? "Approved"
                    : `Approve revision ${workspace.revision}`}
                </button>
              </section>
            </div>
          </section>
        ) : null}
      </section>

      <aside className="editor-inspector" aria-label="Pokémon workspace inspector">
        <section className="inspector-block sticky-save">
          <div className="inspector-title">
            <h2>
              <FloppyDisk aria-hidden="true" /> Save state
            </h2>
            <StatusLamp tone={saveTone(saveState)} label={saveLabel(saveState)} />
          </div>
          <p className="fine-print" aria-live="polite">
            {message}
          </p>
        </section>
        <section className="inspector-block">
          <div className="inspector-title">
            <h2>
              <TreeStructure aria-hidden="true" /> Evolution review
            </h2>
            <span className="count-badge">{workspace.family.members.length}</span>
          </div>
          <p>
            {workspace.family.stage.label} in the {workspace.family.displayName}.
          </p>
          <p className="fine-print">
            Factual fields never inherit. Capability and job decisions are explicit per form.
          </p>
        </section>
        <section className="inspector-block">
          <div className="inspector-title">
            <h2>
              <CheckCircle aria-hidden="true" /> Completion
            </h2>
            <span className="count-badge">{completion}%</span>
          </div>
          <progress max={100} value={completion}>
            {completion}%
          </progress>
          <p className="fine-print">Completion is guidance, not an automatic approval.</p>
        </section>
        {workspace.capabilities.some((capability) => capability.inheritanceState === "outdated") ? (
          <section className="inspector-block conflict-block">
            <h2>
              <WarningCircle aria-hidden="true" /> Inheritance outdated
            </h2>
            <p>
              A parent relationship changed. Review each descendant without silently overwriting it.
            </p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => changeTab("blueprint")}
            >
              Review Blueprint
            </button>
          </section>
        ) : null}
        {saveState === "conflict" ? (
          <section className="inspector-block conflict-block">
            <h2>
              <WarningCircle aria-hidden="true" /> Remote revision
            </h2>
            <p>Your local fields have not been overwritten.</p>
            <div className="button-row">
              <button className="button button-secondary" type="button" onClick={refreshFromRemote}>
                <ArrowClockwise aria-hidden="true" /> Refresh
              </button>
              {remoteWorkspace ? (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={continueFromRemote}
                >
                  Continue from r{remoteWorkspace.revision}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
        <section className="inspector-block">
          <h2>
            <Flask aria-hidden="true" /> Validation
          </h2>
          <StatusLamp
            tone={completion >= 70 ? "green" : "amber"}
            label={completion >= 70 ? "Core fields ready" : "Design still forming"}
          />
          <p className="fine-print">
            Blueprint validation runs before the staged change set can apply.
          </p>
        </section>
      </aside>
    </div>
  );
}

function ControlledSelect({
  label,
  field,
  value,
  options,
  onChange,
  source,
}: {
  label: string;
  field: string;
  value: string;
  options: PokemonWorkspaceData["controlledValues"][string];
  onChange: (value: string) => void;
  source: PokemonWorkspaceData["provenance"][number] | undefined;
}) {
  return (
    <label className="fact-field" htmlFor={`fact-${field}`}>
      <span>{label}</span>
      <select id={`fact-${field}`} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
      </select>
      <FactSource source={source} />
    </label>
  );
}

function FactSource({
  source,
}: {
  source: PokemonWorkspaceData["provenance"][number] | undefined;
}) {
  if (!source) return <small className="fact-source">No imported source attached.</small>;
  return (
    <small className="fact-source">
      Original: {String(source.importedValue ?? "—")} · {source.sourceSheet} row {source.sourceRow}
      {source.overriddenAt ? " · Studio override" : ""}
    </small>
  );
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}
