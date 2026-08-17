"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import {
  ArrowsClockwise,
  ArrowUDownLeft,
  ArrowUDownRight,
  CheckCircle,
  ClipboardText,
  Cube,
  Factory,
  Gear,
  Graph,
  HandGrabbing,
  ListBullets,
  MagnifyingGlass,
  NotePencil,
  PawPrint,
  Plus,
  Selection,
  ShieldWarning,
  Sparkle,
  Stack,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { StatusLamp } from "@/components/ui";
import type {
  BlueprintEdgeData,
  BlueprintLibraryItem,
  BlueprintNodeData,
  BlueprintNodeFamily,
  BlueprintOperation,
  BlueprintRelationshipKind,
  BlueprintValidationFinding,
  FamilyBlueprint,
  InheritanceDecision,
  StudioObject,
  TypeCapabilitySuggestion,
} from "@/data/studio-types";
import {
  applyBlueprintChanges,
  approveBlueprintRecord,
  checkBlueprintHead,
  saveBlueprintView,
} from "@/server/studio-beta-actions";

interface BlueprintFlowNodeData extends Record<string, unknown> {
  blueprint: BlueprintNodeData;
}

interface BlueprintFlowEdgeData extends Record<string, unknown> {
  blueprint: BlueprintEdgeData;
}

type BlueprintFlowNode = Node<BlueprintFlowNodeData, BlueprintNodeFamily>;
type BlueprintFlowEdge = Edge<BlueprintFlowEdgeData>;

interface GraphSnapshot {
  nodes: BlueprintFlowNode[];
  edges: BlueprintFlowEdge[];
  operations: BlueprintOperation[];
}

const nodeIcons: Record<BlueprintNodeFamily, ComponentType<{ "aria-hidden": true }>> = {
  worker: PawPrint,
  capability: Gear,
  job: ClipboardText,
  worksite: Factory,
  interlock: ShieldWarning,
  result: Cube,
};

const nodeLabels: Record<BlueprintNodeFamily, string> = {
  worker: "Worker Card",
  capability: "Capability Gear",
  job: "Job Ticket",
  worksite: "Worksite",
  interlock: "Safety Interlock",
  result: "Result Crate",
};

const relationshipLabels: Record<BlueprintRelationshipKind, string> = {
  has_capability: "Has capability",
  requires_capability: "Requires capability",
  assigned_to_job: "Assigned to job",
  operates_at: "Operates at worksite",
  constrained_by: "Constrained by",
  produces_result: "Produces result",
  evolves_to: "Evolves to",
};

const handlePairs: Record<BlueprintRelationshipKind, [string, string]> = {
  has_capability: ["worker:capability", "capability:worker"],
  requires_capability: ["job:requirement", "capability:job"],
  assigned_to_job: ["worker:job", "job:worker"],
  operates_at: ["job:worksite", "worksite:job"],
  constrained_by: ["rule:condition", "interlock:rule"],
  produces_result: ["job:result", "result:job"],
  evolves_to: ["worker:evolution", "worker:evolution"],
};

const relationshipNodeFamilies: Record<
  BlueprintRelationshipKind,
  { source: BlueprintNodeFamily[]; target: BlueprintNodeFamily[] }
> = {
  has_capability: { source: ["worker"], target: ["capability"] },
  requires_capability: { source: ["job"], target: ["capability"] },
  assigned_to_job: { source: ["worker"], target: ["job"] },
  operates_at: { source: ["job"], target: ["worksite"] },
  constrained_by: { source: ["worker", "job", "worksite"], target: ["interlock"] },
  produces_result: { source: ["job"], target: ["result"] },
  evolves_to: { source: ["worker"], target: ["worker"] },
};

const inheritanceOptions: readonly InheritanceDecision[] = [
  "keep",
  "raise",
  "lower",
  "replace",
  "remove",
  "add",
];

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}

function BlueprintNodeCard({ data, selected }: NodeProps<BlueprintFlowNode>) {
  const item = data.blueprint;
  const Icon = nodeIcons[item.nodeFamily];
  return (
    <article
      className={`blueprint-node blueprint-node-${item.nodeFamily}`}
      data-selected={selected}
      aria-label={`${nodeLabels[item.nodeFamily]}: ${item.displayName}`}
    >
      {item.nodeFamily === "worker" ? (
        <>
          <Handle
            id="worker:evolution"
            type="target"
            position={Position.Left}
            className="blueprint-port blueprint-port-evolution"
            aria-label="Evolution input"
          />
          <Handle
            id="worker:evolution"
            type="source"
            position={Position.Right}
            className="blueprint-port blueprint-port-evolution"
            aria-label="Evolution output"
          />
          <Handle
            id="worker:capability"
            type="source"
            position={Position.Bottom}
            className="blueprint-port blueprint-port-capability blueprint-port-offset-left"
            aria-label="Capability output"
          />
          <Handle
            id="worker:job"
            type="source"
            position={Position.Bottom}
            className="blueprint-port blueprint-port-job blueprint-port-offset-right"
            aria-label="Job output"
          />
        </>
      ) : null}
      {item.nodeFamily === "capability" ? (
        <>
          <Handle
            id="capability:worker"
            type="target"
            position={Position.Top}
            className="blueprint-port blueprint-port-capability blueprint-port-offset-left"
            aria-label="Worker capability input"
          />
          <Handle
            id="capability:job"
            type="target"
            position={Position.Top}
            className="blueprint-port blueprint-port-capability blueprint-port-offset-right"
            aria-label="Job requirement input"
          />
        </>
      ) : null}
      {item.nodeFamily === "job" ? (
        <>
          <Handle
            id="job:worker"
            type="target"
            position={Position.Left}
            className="blueprint-port blueprint-port-job"
            aria-label="Worker assignment input"
          />
          <Handle
            id="job:requirement"
            type="source"
            position={Position.Top}
            className="blueprint-port blueprint-port-capability"
            aria-label="Capability requirement output"
          />
          <Handle
            id="job:worksite"
            type="source"
            position={Position.Right}
            className="blueprint-port blueprint-port-worksite blueprint-port-offset-top"
            aria-label="Worksite output"
          />
          <Handle
            id="rule:condition"
            type="source"
            position={Position.Right}
            className="blueprint-port blueprint-port-interlock"
            aria-label="Safety condition output"
          />
          <Handle
            id="job:result"
            type="source"
            position={Position.Right}
            className="blueprint-port blueprint-port-result blueprint-port-offset-bottom"
            aria-label="Result output"
          />
        </>
      ) : null}
      {item.nodeFamily === "worksite" ? (
        <Handle
          id="worksite:job"
          type="target"
          position={Position.Left}
          className="blueprint-port blueprint-port-worksite"
          aria-label="Job worksite input"
        />
      ) : null}
      {item.nodeFamily === "interlock" ? (
        <Handle
          id="interlock:rule"
          type="target"
          position={Position.Left}
          className="blueprint-port blueprint-port-interlock"
          aria-label="Safety condition input"
        />
      ) : null}
      {item.nodeFamily === "result" ? (
        <Handle
          id="result:job"
          type="target"
          position={Position.Left}
          className="blueprint-port blueprint-port-result"
          aria-label="Job result input"
        />
      ) : null}
      <header>
        <Icon aria-hidden={true} />
        <span>{nodeLabels[item.nodeFamily]}</span>
      </header>
      <strong>{item.displayName}</strong>
      {item.nationalDex ? (
        <span className="blueprint-node-dex">#{String(item.nationalDex).padStart(3, "0")}</span>
      ) : null}
      <div className="blueprint-node-meta">
        {item.types.map((type) => (
          <span key={type}>{type}</span>
        ))}
        <span>{item.workflowState.replaceAll("_", " ")}</span>
      </div>
    </article>
  );
}

const nodeTypes = {
  worker: BlueprintNodeCard,
  capability: BlueprintNodeCard,
  job: BlueprintNodeCard,
  worksite: BlueprintNodeCard,
  interlock: BlueprintNodeCard,
  result: BlueprintNodeCard,
};

function toFlowNodes(blueprint: FamilyBlueprint): BlueprintFlowNode[] {
  return blueprint.nodes.map((node) => ({
    id: node.id,
    type: node.nodeFamily,
    position: node.position,
    data: { blueprint: node },
    width: node.width ?? undefined,
    height: node.height ?? undefined,
    ariaLabel: `${nodeLabels[node.nodeFamily]}: ${node.displayName}`,
  }));
}

function toFlowEdges(blueprint: FamilyBlueprint): BlueprintFlowEdge[] {
  return blueprint.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    data: { blueprint: edge },
    markerEnd: { type: MarkerType.ArrowClosed },
    className: `blueprint-edge blueprint-edge-${edge.relationshipKind}${edge.inheritanceState === "outdated" ? " blueprint-edge-outdated" : ""}`,
    focusable: true,
    ariaLabel: `${edge.label}: ${edge.source} to ${edge.target}`,
  }));
}

function relationshipForHandles(
  sourceHandle: string | null,
  targetHandle: string | null,
): BlueprintRelationshipKind | null {
  const entry = Object.entries(handlePairs).find(
    ([, handles]) => handles[0] === sourceHandle && handles[1] === targetHandle,
  );
  return (entry?.[0] as BlueprintRelationshipKind | undefined) ?? null;
}

function validateGraph(
  nodes: readonly BlueprintFlowNode[],
  edges: readonly BlueprintFlowEdge[],
): BlueprintValidationFinding[] {
  const findings: BlueprintValidationFinding[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relationships = new Set<string>();
  for (const edge of edges) {
    const data = edge.data?.blueprint;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      findings.push({
        code: "missing_endpoint",
        severity: "error",
        message: `${data?.label ?? "Relationship"} points to a node that is not on this board.`,
        relationshipPublicId: edge.id,
      });
      continue;
    }
    const key = `${edge.source}|${edge.target}|${data?.relationshipKind}`;
    if (relationships.has(key)) {
      findings.push({
        code: "duplicate_relationship",
        severity: "error",
        message: "The same typed relationship appears more than once.",
        relationshipPublicId: edge.id,
      });
    }
    relationships.add(key);
    if (
      data?.relationshipKind === "has_capability" &&
      (!Number.isInteger(Number(data.metadata.tier)) ||
        Number(data.metadata.tier) < 1 ||
        Number(data.metadata.tier) > 4)
    ) {
      findings.push({
        code: "invalid_capability_tier",
        severity: "error",
        message: "Worker capabilities require an explicit tier from 1 to 4.",
        relationshipPublicId: edge.id,
      });
    }
    if (data?.inheritanceState === "outdated") {
      findings.push({
        code: "inheritance_outdated",
        severity: "warning",
        message: "A parent design changed; review this inherited relationship before approval.",
        relationshipPublicId: edge.id,
      });
    }
  }
  for (const node of nodes) {
    if (node.data.blueprint.data.needs_completion === true) {
      findings.push({
        code: "incomplete_draft_stub",
        severity: "error",
        message: `${node.data.blueprint.displayName} needs a description before this draft can be applied.`,
        recordPublicId: node.id,
      });
    }
  }
  const evolutionEdges = edges.filter(
    (edge) => edge.data?.blueprint.relationshipKind === "evolves_to",
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const children = new Map<string, string[]>();
  for (const edge of evolutionEdges) {
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }
  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const child of children.get(nodeId) ?? []) {
      if (visit(child)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }
  if (nodes.some((node) => visit(node.id))) {
    findings.push({
      code: "evolution_cycle",
      severity: "error",
      message: "Evolution connections must remain acyclic.",
    });
  }
  return findings;
}

function autoLayout(
  nodes: readonly BlueprintFlowNode[],
  edges: readonly BlueprintFlowEdge[],
): BlueprintFlowNode[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: 90, nodesep: 55, marginx: 45, marginy: 45 });
  for (const node of nodes)
    graph.setNode(node.id, { width: node.width ?? 230, height: node.height ?? 122 });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id) as { x: number; y: number };
    return {
      ...node,
      position: {
        x: position.x - (node.width ?? 230) / 2,
        y: position.y - (node.height ?? 122) / 2,
      },
    };
  });
}

function snapshot(
  nodes: BlueprintFlowNode[],
  edges: BlueprintFlowEdge[],
  operations: BlueprintOperation[],
): GraphSnapshot {
  return structuredClone({ nodes, edges, operations });
}

export function KineticBlueprint({
  initialBlueprint,
  library,
  activeFormPublicId,
  typeSuggestions,
  onApplied,
}: {
  initialBlueprint: FamilyBlueprint;
  library: BlueprintLibraryItem[];
  activeFormPublicId: string;
  typeSuggestions: TypeCapabilitySuggestion[];
  onApplied: (blueprint: FamilyBlueprint) => void;
}) {
  const [blueprint, setBlueprint] = useState(initialBlueprint);
  const [nodes, setNodes] = useState<BlueprintFlowNode[]>(() => toFlowNodes(initialBlueprint));
  const [edges, setEdges] = useState<BlueprintFlowEdge[]>(() => toFlowEdges(initialBlueprint));
  const [operations, setOperations] = useState<BlueprintOperation[]>([]);
  const [past, setPast] = useState<GraphSnapshot[]>([]);
  const [future, setFuture] = useState<GraphSnapshot[]>([]);
  const [mode, setMode] = useState<"canvas" | "outline">(
    initialBlueprint.preference.lastView === "outline" ? "outline" : "canvas",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(
    null,
  );
  const [stubKind, setStubKind] = useState<
    "capability" | "job" | "work_target" | "condition" | "result" | null
  >(null);
  const [stubName, setStubName] = useState("");
  const [stubDescription, setStubDescription] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFamily, setLibraryFamily] = useState<BlueprintNodeFamily | "all">("all");
  const [annotationKind, setAnnotationKind] = useState<"group" | "comment" | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [stagedSuggestionIds, setStagedSuggestionIds] = useState<Set<string>>(() => new Set());
  const [outlineSource, setOutlineSource] = useState("");
  const [outlineTarget, setOutlineTarget] = useState("");
  const [outlineKind, setOutlineKind] = useState<BlueprintRelationshipKind>("has_capability");
  const [validationOpen, setValidationOpen] = useState(true);
  const [message, setMessage] = useState("Relationship edits are staged until Apply Changes.");
  const [remoteRevision, setRemoteRevision] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isApproving, startApproval] = useTransition();
  const flowRef = useRef<ReactFlowInstance<BlueprintFlowNode, BlueprintFlowEdge> | null>(null);
  const dragStartRef = useRef<GraphSnapshot | null>(null);

  const findings = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);
  const hasErrors = findings.some((finding) => finding.severity === "error");
  const dirty = operations.length > 0 || past.length > 0;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedEdge = selectedId ? edges.find((edge) => edge.id === selectedId) : undefined;
  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const present = new Set(nodes.map((node) => node.id));
    return library.filter(
      (item) =>
        !present.has(item.publicId) &&
        (libraryFamily === "all" || item.nodeFamily === libraryFamily) &&
        (!query ||
          item.displayName.toLowerCase().includes(query) ||
          item.publicId.toLowerCase().includes(query)),
    );
  }, [library, libraryFamily, libraryQuery, nodes]);

  useEffect(() => {
    if (
      initialBlueprint.preference.lastView !== "canvas" &&
      initialBlueprint.preference.lastView !== "outline" &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      const frame = window.requestAnimationFrame(() => setMode("outline"));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [initialBlueprint.preference.lastView]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void checkBlueprintHead(blueprint.board.publicId)
        .then((head) => {
          if (head.revision !== blueprint.board.revision) setRemoteRevision(head.revision);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [blueprint.board.publicId, blueprint.board.revision]);

  const commit = useCallback(
    (
      nextNodes: BlueprintFlowNode[],
      nextEdges: BlueprintFlowEdge[],
      nextOperations: BlueprintOperation[],
    ) => {
      setPast((history) => [...history.slice(-39), snapshot(nodes, edges, operations)]);
      setFuture([]);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setOperations(nextOperations);
    },
    [edges, nodes, operations],
  );

  function undo(): void {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((history) => [snapshot(nodes, edges, operations), ...history.slice(0, 39)]);
    setPast((history) => history.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setOperations(previous.operations);
  }

  function redo(): void {
    const next = future[0];
    if (!next) return;
    setPast((history) => [...history.slice(-39), snapshot(nodes, edges, operations)]);
    setFuture((history) => history.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setOperations(next.operations);
  }

  function stageRelationship(
    source: string,
    target: string,
    kind: BlueprintRelationshipKind,
    metadata: StudioObject,
    decision?: InheritanceDecision,
  ): void {
    const duplicate = edges.some(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        edge.data?.blueprint.relationshipKind === kind,
    );
    if (duplicate) {
      setMessage("That typed relationship is already on this board.");
      return;
    }
    const [sourceHandle, targetHandle] = handlePairs[kind];
    const id = `cobblemon_kinetics:relationship/draft-${crypto.randomUUID()}`;
    const blueprintEdge: BlueprintEdgeData = {
      id,
      relationshipKind: kind,
      source,
      target,
      sourceHandle,
      targetHandle,
      label: relationshipLabels[kind],
      metadata,
      inheritanceDecision: decision ?? null,
      inheritanceState: decision ? "current" : "not_applicable",
      workflowState: "draft",
      recordRevision: 0,
    };
    const nextEdge: BlueprintFlowEdge = {
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      label: blueprintEdge.label,
      data: { blueprint: blueprintEdge },
      markerEnd: { type: MarkerType.ArrowClosed },
      className: `blueprint-edge blueprint-edge-${kind}`,
    };
    commit(
      [...nodes],
      [...edges, nextEdge],
      [
        ...operations,
        {
          type: "upsert_relationship",
          source_public_id: source,
          target_public_id: target,
          relationship_kind: kind,
          metadata,
          ...(decision ? { inheritance_decision: decision } : {}),
          source_handle: sourceHandle,
          target_handle: targetHandle,
        },
      ],
    );
    setSelectedId(id);
    setMessage(`${relationshipLabels[kind]} staged. Apply Changes to share it.`);
  }

  function onConnect(connection: Connection): void {
    if (!connection.source || !connection.target) return;
    const kind = relationshipForHandles(connection.sourceHandle, connection.targetHandle);
    if (!kind) {
      setMessage("Those ports are not compatible. Port labels show the required relationship.");
      return;
    }
    const metadata: StudioObject =
      kind === "has_capability"
        ? { tier: 1, tier_label: "Basic" }
        : kind === "requires_capability"
          ? { minimum_tier: 1 }
          : {};
    stageRelationship(connection.source, connection.target, kind, metadata);
  }

  function onPaneContextMenu(event: MouseEvent | ReactMouseEvent): void {
    event.preventDefault();
    const position = flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setMenu({
      x: event.clientX,
      y: event.clientY,
      flowX: position?.x ?? 0,
      flowY: position?.y ?? 0,
    });
    setStubKind(null);
    setStubName("");
    setStubDescription("");
  }

  function addLibraryItem(item: BlueprintLibraryItem): void {
    const position = { x: menu?.flowX ?? 120, y: menu?.flowY ?? 120 };
    const blueprintNode: BlueprintNodeData = {
      id: item.publicId,
      recordKind: item.recordKind,
      nodeFamily: item.nodeFamily,
      displayName: item.displayName,
      workflowState: item.workflowState,
      recordRevision: item.revision,
      position,
      width: 220,
      height: 116,
      groupKey: null,
      collapsed: false,
      nationalDex: null,
      types: [],
      data: {},
    };
    commit(
      [
        ...nodes,
        {
          id: item.publicId,
          type: item.nodeFamily,
          position,
          data: { blueprint: blueprintNode },
        },
      ],
      [...edges],
      [...operations, { type: "add_node", record_public_id: item.publicId, position }],
    );
    setMenu(null);
    setSelectedId(item.publicId);
  }

  function createStub(): void {
    if (!stubKind || !stubName.trim() || !menu) return;
    const id = `cobblemon_kinetics:${stubKind.replaceAll("_", "-")}/draft-${crypto.randomUUID()}`;
    const family =
      stubKind === "work_target" ? "worksite" : stubKind === "condition" ? "interlock" : stubKind;
    const position = { x: menu.flowX, y: menu.flowY };
    const item: BlueprintNodeData = {
      id,
      recordKind: stubKind,
      nodeFamily: family,
      displayName: stubName.trim(),
      workflowState: "draft",
      recordRevision: 0,
      position,
      width: 220,
      height: 116,
      groupKey: null,
      collapsed: false,
      nationalDex: null,
      types: [],
      data: {
        draft_stub: true,
        needs_completion: !stubDescription.trim(),
        description: stubDescription.trim(),
      },
    };
    commit(
      [...nodes, { id, type: family, position, data: { blueprint: item } }],
      [...edges],
      [
        ...operations,
        {
          type: "create_stub",
          record_public_id: id,
          record_kind: stubKind,
          display_name: stubName.trim(),
          description: stubDescription.trim(),
          position,
        },
      ],
    );
    setMenu(null);
    setSelectedId(id);
  }

  function updateDraftStubDescription(node: BlueprintFlowNode, description: string): void {
    const nextNodes = nodes.map((candidate) =>
      candidate.id === node.id
        ? {
            ...candidate,
            data: {
              blueprint: {
                ...candidate.data.blueprint,
                data: {
                  ...candidate.data.blueprint.data,
                  description,
                  needs_completion: !description.trim(),
                },
              },
            },
          }
        : candidate,
    );
    const nextOperations = operations.map((operation) =>
      operation.type === "create_stub" && operation.record_public_id === node.id
        ? { ...operation, description }
        : operation,
    );
    commit(nextNodes, [...edges], nextOperations);
  }

  function addAnnotation(): void {
    if (!annotationKind || !annotationBody.trim() || !menu) return;
    commit(
      [...nodes],
      [...edges],
      [
        ...operations,
        {
          type: "add_annotation",
          annotation_kind: annotationKind,
          body: annotationBody.trim(),
          position: { x: menu.flowX, y: menu.flowY },
          ...(annotationKind === "group" ? { width: 640, height: 300 } : {}),
        },
      ],
    );
    setAnnotationKind(null);
    setAnnotationBody("");
    setMenu(null);
    setMessage(`${titleCase(annotationKind)} staged for the shared board.`);
  }

  async function pasteRecord(): Promise<void> {
    try {
      const publicId = (await navigator.clipboard.readText()).trim();
      const item = library.find((candidate) => candidate.publicId === publicId);
      if (!item) {
        setMessage("Clipboard text is not an available Blueprint record ID.");
        return;
      }
      addLibraryItem(item);
    } catch {
      setMessage("Clipboard access was unavailable. Use catalog search instead.");
    }
  }

  function acceptTypeSuggestion(suggestion: TypeCapabilitySuggestion): void {
    if (suggestion.accepted || stagedSuggestionIds.has(suggestion.id)) return;
    const capability = library.find((item) => item.publicId === suggestion.capabilityPublicId);
    const worker = nodes.find((node) => node.id === activeFormPublicId);
    if (!capability || !worker) {
      setMessage("This suggestion is missing its form or capability catalog record.");
      return;
    }
    const capabilityPosition = { x: worker.position.x + 80, y: worker.position.y + 230 };
    const capabilityIsPresent = nodes.some((node) => node.id === capability.publicId);
    const nextNodes: BlueprintFlowNode[] = capabilityIsPresent
      ? [...nodes]
      : [
          ...nodes,
          {
            id: capability.publicId,
            type: capability.nodeFamily,
            position: capabilityPosition,
            data: {
              blueprint: {
                id: capability.publicId,
                recordKind: capability.recordKind,
                nodeFamily: capability.nodeFamily,
                displayName: capability.displayName,
                workflowState: capability.workflowState,
                recordRevision: capability.revision,
                position: capabilityPosition,
                width: 220,
                height: 116,
                groupKey: null,
                collapsed: false,
                nationalDex: null,
                types: [],
                data: {},
              },
            },
          },
        ];
    const edgeId = `cobblemon_kinetics:relationship/draft-${crypto.randomUUID()}`;
    const edgeData: BlueprintEdgeData = {
      id: edgeId,
      relationshipKind: "has_capability",
      source: activeFormPublicId,
      target: capability.publicId,
      sourceHandle: handlePairs.has_capability[0],
      targetHandle: handlePairs.has_capability[1],
      label: `Type suggestion · Tier ${suggestion.suggestedTier}`,
      metadata: {
        tier: suggestion.suggestedTier,
        tier_label:
          ["Basic", "Capable", "Advanced", "Exceptional"][suggestion.suggestedTier - 1] ?? "Basic",
      },
      inheritanceDecision: "add",
      inheritanceState: "current",
      workflowState: "draft",
      recordRevision: 0,
    };
    commit(
      nextNodes,
      [
        ...edges,
        {
          id: edgeId,
          source: activeFormPublicId,
          target: capability.publicId,
          sourceHandle: edgeData.sourceHandle,
          targetHandle: edgeData.targetHandle,
          label: edgeData.label,
          data: { blueprint: edgeData },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: "blueprint-edge blueprint-edge-has_capability",
        },
      ],
      [
        ...operations,
        {
          type: "accept_type_suggestion",
          suggestion_id: suggestion.id,
          form_public_id: activeFormPublicId,
          tier: suggestion.suggestedTier,
          position: capabilityPosition,
        },
      ],
    );
    setStagedSuggestionIds((current) => new Set(current).add(suggestion.id));
    setMessage(`${suggestion.name} accepted locally. Apply Changes to share it.`);
  }

  function runAutoLayout(): void {
    commit(autoLayout(nodes, edges), [...edges], [...operations, { type: "auto_layout" }]);
    setMenu(null);
    window.requestAnimationFrame(
      () => void flowRef.current?.fitView({ padding: 0.15, duration: 250 }),
    );
  }

  function setInheritanceDecision(edge: BlueprintFlowEdge, decision: InheritanceDecision): void {
    const data = edge.data?.blueprint;
    if (!data) return;
    const nextEdges = edges.map((candidate) =>
      candidate.id === edge.id
        ? {
            ...candidate,
            data: {
              blueprint: {
                ...data,
                inheritanceDecision: decision,
                inheritanceState: "current" as const,
              },
            },
          }
        : candidate,
    );
    const operation: BlueprintOperation = data.id.includes("/draft-")
      ? {
          type: "upsert_relationship",
          source_public_id: data.source,
          target_public_id: data.target,
          relationship_kind: data.relationshipKind,
          metadata: data.metadata,
          inheritance_decision: decision,
          source_handle: data.sourceHandle,
          target_handle: data.targetHandle,
        }
      : {
          type: "set_inheritance_decision",
          relationship_public_id: data.id,
          decision,
          metadata: data.metadata,
        };
    commit([...nodes], nextEdges, [...operations, operation]);
  }

  function setCapabilityTier(edge: BlueprintFlowEdge, tier: number): void {
    const data = edge.data?.blueprint;
    if (!data || data.relationshipKind !== "has_capability") return;
    const nextData = {
      ...data,
      metadata: {
        ...data.metadata,
        tier,
        tier_label: ["Basic", "Capable", "Advanced", "Exceptional"][tier - 1]!,
      },
    };
    const nextEdges = edges.map((candidate) =>
      candidate.id === edge.id ? { ...candidate, data: { blueprint: nextData } } : candidate,
    );
    const operation: BlueprintOperation = data.id.includes("/draft-")
      ? {
          type: "upsert_relationship",
          source_public_id: data.source,
          target_public_id: data.target,
          relationship_kind: data.relationshipKind,
          metadata: nextData.metadata,
          ...(data.inheritanceDecision ? { inheritance_decision: data.inheritanceDecision } : {}),
          source_handle: data.sourceHandle,
          target_handle: data.targetHandle,
        }
      : {
          type: "set_inheritance_decision",
          relationship_public_id: data.id,
          decision: data.inheritanceDecision ?? "keep",
          metadata: nextData.metadata,
        };
    commit([...nodes], nextEdges, [...operations, operation]);
  }

  function removeSelectedFromBoard(): void {
    if (selectedNode) {
      commit(
        nodes.filter((node) => node.id !== selectedNode.id),
        edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
        [...operations, { type: "remove_node", record_public_id: selectedNode.id }],
      );
    } else if (selectedEdge) {
      commit(
        [...nodes],
        edges.filter((edge) => edge.id !== selectedEdge.id),
        selectedEdge.id.includes("/draft-")
          ? operations.filter(
              (operation) =>
                operation.type !== "upsert_relationship" ||
                operation.source_public_id !== selectedEdge.source ||
                operation.target_public_id !== selectedEdge.target,
            )
          : [...operations, { type: "remove_edge", relationship_public_id: selectedEdge.id }],
      );
    }
    setSelectedId(null);
  }

  function archiveSelectedRelationship(): void {
    if (!selectedEdge || selectedEdge.id.includes("/draft-")) return;
    if (
      !window.confirm(
        "Archive this relationship for everyone? This is separate from removing it from the board.",
      )
    )
      return;
    commit(
      [...nodes],
      edges.filter((edge) => edge.id !== selectedEdge.id),
      [
        ...operations,
        {
          type: "archive_relationship",
          relationship_public_id: selectedEdge.id,
          confirmed: true,
        },
      ],
    );
    setSelectedId(null);
    setMessage("Relationship archival staged. Apply Changes to confirm it atomically.");
  }

  function approveSelectedRecord(): void {
    const publicId = selectedNode?.id ?? selectedEdge?.id;
    const revision =
      selectedNode?.data.blueprint.recordRevision ?? selectedEdge?.data?.blueprint.recordRevision;
    if (!publicId || !revision || dirty) return;
    startApproval(async () => {
      const result = await approveBlueprintRecord(publicId, revision);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setNodes((current) =>
        current.map((node) =>
          node.id === publicId
            ? {
                ...node,
                data: {
                  blueprint: {
                    ...node.data.blueprint,
                    workflowState: result.workflowState,
                    recordRevision: result.revision,
                  },
                },
              }
            : node,
        ),
      );
      setEdges((current) =>
        current.map((edge) =>
          edge.id === publicId && edge.data?.blueprint
            ? {
                ...edge,
                data: {
                  blueprint: {
                    ...edge.data.blueprint,
                    workflowState: result.workflowState,
                    recordRevision: result.revision,
                  },
                },
              }
            : edge,
        ),
      );
      setBlueprint((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === publicId
            ? { ...node, workflowState: result.workflowState, recordRevision: result.revision }
            : node,
        ),
        edges: current.edges.map((edge) =>
          edge.id === publicId
            ? { ...edge, workflowState: result.workflowState, recordRevision: result.revision }
            : edge,
        ),
      }));
      setMessage(`Approved ${publicId} at exact revision ${result.revision}.`);
    });
  }

  function applyChanges(): void {
    if (hasErrors || !dirty) return;
    const expectedRecordHeads = Object.fromEntries([
      ...blueprint.nodes
        .filter((node) => node.recordRevision > 0)
        .map((node) => [node.id, node.recordRevision] as const),
      ...blueprint.edges
        .filter((edge) => edge.recordRevision > 0)
        .map((edge) => [edge.id, edge.recordRevision] as const),
      ...nodes
        .filter((node) => node.data.blueprint.recordRevision > 0)
        .map((node) => [node.id, node.data.blueprint.recordRevision] as const),
      ...edges
        .filter((edge) => (edge.data?.blueprint.recordRevision ?? 0) > 0)
        .map((edge) => [edge.id, edge.data!.blueprint.recordRevision] as const),
    ]);
    startTransition(async () => {
      const result = await applyBlueprintChanges({
        boardPublicId: blueprint.board.publicId,
        familyPublicId: blueprint.board.familyPublicId,
        expectedBoardRevision: blueprint.board.revision,
        expectedRecordHeads,
        operations,
        layout: {
          nodes: nodes.map((node) => ({
            record_public_id: node.id,
            position: node.position,
            group_key: node.data.blueprint.groupKey,
            collapsed: node.data.blueprint.collapsed,
          })),
        },
        clientMutationId: crypto.randomUUID(),
      });
      if (!result.ok) {
        if (result.kind === "conflict") {
          setRemoteRevision(result.currentBoardRevision ?? blueprint.board.revision + 1);
          setMessage(
            result.staleEntities.length
              ? `Conflict: ${result.staleEntities.map((entity) => entity.publicId).join(", ")}`
              : result.message,
          );
        } else setMessage(result.message);
        return;
      }
      setBlueprint(result.blueprint);
      setNodes(toFlowNodes(result.blueprint));
      setEdges(toFlowEdges(result.blueprint));
      setOperations([]);
      setPast([]);
      setFuture([]);
      setRemoteRevision(null);
      setMessage(`Shared board revision ${result.blueprint.board.revision} saved atomically.`);
      onApplied(result.blueprint);
    });
  }

  function changeMode(nextMode: "canvas" | "outline"): void {
    setMode(nextMode);
    void saveBlueprintView({
      boardPublicId: blueprint.board.publicId,
      viewport: blueprint.preference.viewport,
      filters: { ...blueprint.preference.filters, last_view: nextMode },
      hiddenNodes: blueprint.preference.hiddenNodes,
    }).catch(() => undefined);
  }

  function saveViewport(viewport: Viewport): void {
    void saveBlueprintView({
      boardPublicId: blueprint.board.publicId,
      viewport,
      filters: { ...blueprint.preference.filters, last_view: mode },
      hiddenNodes: blueprint.preference.hiddenNodes,
    }).catch(() => undefined);
  }

  return (
    <section className="kinetic-blueprint" aria-labelledby="blueprint-heading">
      <header className="blueprint-toolbar">
        <div>
          <p className="eyebrow">Shared family schematic · r{blueprint.board.revision}</p>
          <h2 id="blueprint-heading">
            <Graph aria-hidden="true" /> Kinetic Blueprint
          </h2>
        </div>
        <div className="blueprint-mode-toggle" aria-label="Blueprint view" role="group">
          <button
            aria-pressed={mode === "canvas"}
            className="button button-secondary"
            type="button"
            onClick={() => changeMode("canvas")}
          >
            <Graph aria-hidden="true" /> Canvas
          </button>
          <button
            aria-pressed={mode === "outline"}
            className="button button-secondary"
            type="button"
            onClick={() => changeMode("outline")}
          >
            <ListBullets aria-hidden="true" /> Outline
          </button>
        </div>
        <div className="blueprint-actions">
          <button
            className="button button-secondary"
            disabled={!past.length}
            type="button"
            onClick={undo}
          >
            <ArrowUDownLeft aria-hidden="true" /> Undo
          </button>
          <button
            className="button button-secondary"
            disabled={!future.length}
            type="button"
            onClick={redo}
          >
            <ArrowUDownRight aria-hidden="true" /> Redo
          </button>
          <button
            className="button button-primary"
            disabled={!dirty || hasErrors || isPending || remoteRevision !== null}
            type="button"
            onClick={applyChanges}
          >
            <CheckCircle aria-hidden="true" /> {isPending ? "Applying…" : "Apply Changes"}
          </button>
        </div>
      </header>

      {remoteRevision !== null ? (
        <div className="blueprint-conflict" role="alert">
          <WarningCircle aria-hidden="true" />
          <div>
            <strong>Shared board changed to revision {remoteRevision}</strong>
            <p>Your staged work is still local. Refresh and compare before applying.</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            <ArrowsClockwise aria-hidden="true" /> Refresh board
          </button>
        </div>
      ) : null}

      <div className="blueprint-status" aria-live="polite">
        <HandGrabbing aria-hidden="true" /> {message}
      </div>

      {typeSuggestions.some(
        (suggestion) => !suggestion.accepted && !stagedSuggestionIds.has(suggestion.id),
      ) ? (
        <section className="blueprint-suggestions" aria-label="Type Workshop suggestions">
          <header>
            <Sparkle aria-hidden="true" />
            <div>
              <strong>Ghosted Type Workshop suggestions</strong>
              <span>Nothing becomes active until you accept it for this exact form.</span>
            </div>
          </header>
          {typeSuggestions
            .filter((suggestion) => !suggestion.accepted && !stagedSuggestionIds.has(suggestion.id))
            .map((suggestion) => (
              <article key={suggestion.id}>
                <div>
                  <strong>{suggestion.name}</strong>
                  <span>
                    Tier {suggestion.suggestedTier} · {suggestion.rationale}
                  </span>
                </div>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => acceptTypeSuggestion(suggestion)}
                >
                  <CheckCircle aria-hidden="true" /> Accept for this form
                </button>
              </article>
            ))}
        </section>
      ) : null}

      {blueprint.annotations.length ? (
        <section className="blueprint-annotation-strip" aria-label="Shared board notes and groups">
          {blueprint.annotations.map((annotation) => (
            <article key={annotation.id}>
              {annotation.annotationKind === "group" ? (
                <Stack aria-hidden="true" />
              ) : (
                <NotePencil aria-hidden="true" />
              )}
              <div>
                <strong>{titleCase(annotation.annotationKind)}</strong>
                <span>{annotation.body}</span>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {mode === "canvas" ? (
        <div className="blueprint-canvas-shell">
          <ReactFlow<BlueprintFlowNode, BlueprintFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onNodesChange={(changes: NodeChange<BlueprintFlowNode>[]) =>
              setNodes((current) => applyNodeChanges(changes, current))
            }
            onEdgesChange={(changes: EdgeChange<BlueprintFlowEdge>[]) =>
              setEdges((current) => applyEdgeChanges(changes, current))
            }
            onNodeDragStart={() => {
              dragStartRef.current = snapshot(nodes, edges, operations);
            }}
            onNodeDragStop={(_, node) => {
              if (dragStartRef.current) {
                setPast((history) => [...history.slice(-39), dragStartRef.current!]);
                setFuture([]);
              }
              dragStartRef.current = null;
              setOperations((current) => [
                ...current,
                { type: "move_node", record_public_id: node.id, position: node.position },
              ]);
            }}
            onConnect={onConnect}
            onConnectEnd={(event, connectionState) => {
              if (connectionState.isValid || connectionState.toNode) return;
              const point = "changedTouches" in event ? event.changedTouches[0] : event;
              if (!point) return;
              const position = flowRef.current?.screenToFlowPosition({
                x: point.clientX,
                y: point.clientY,
              });
              setMenu({
                x: point.clientX,
                y: point.clientY,
                flowX: position?.x ?? 0,
                flowY: position?.y ?? 0,
              });
            }}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onEdgeClick={(_, edge) => setSelectedId(edge.id)}
            onPaneClick={() => {
              setSelectedId(null);
              setMenu(null);
            }}
            onPaneContextMenu={onPaneContextMenu}
            onMoveEnd={(_, viewport) => saveViewport(viewport)}
            defaultViewport={blueprint.preference.viewport}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={2.5}
            nodesFocusable
            edgesFocusable
            selectionOnDrag
            panOnScroll
            aria-label="Family Kinetic Blueprint relationship canvas"
          >
            <Background gap={24} size={1} />
            <MiniMap
              pannable
              zoomable
              ariaLabel="Kinetic Blueprint minimap"
              nodeColor={(node) => `var(--blueprint-${node.type ?? "worker"})`}
            />
            <Controls aria-label="Blueprint pan and zoom controls" />
          </ReactFlow>
          {menu ? (
            <div
              className="blueprint-context-menu"
              role="dialog"
              aria-label="Add to Kinetic Blueprint"
              style={{
                left: Math.min(menu.x, window.innerWidth - 330),
                top: Math.min(menu.y, window.innerHeight - 460),
              }}
            >
              <header>
                <strong>Add to Blueprint</strong>
                <button type="button" onClick={() => setMenu(null)} aria-label="Close add menu">
                  ×
                </button>
              </header>
              <label className="field-label">
                <MagnifyingGlass aria-hidden="true" /> Search catalog
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                />
              </label>
              <div
                className="blueprint-library-filters"
                role="group"
                aria-label="Catalog record kind"
              >
                {(
                  ["all", "worker", "capability", "job", "worksite", "interlock", "result"] as const
                ).map((family) => (
                  <button
                    key={family}
                    type="button"
                    aria-pressed={libraryFamily === family}
                    onClick={() => setLibraryFamily(family)}
                  >
                    {family === "all" ? "All" : nodeLabels[family]}
                  </button>
                ))}
              </div>
              <div className="blueprint-library-results">
                {filteredLibrary.slice(0, 8).map((item) => (
                  <button key={item.publicId} type="button" onClick={() => addLibraryItem(item)}>
                    {(() => {
                      const Icon = nodeIcons[item.nodeFamily];
                      return <Icon aria-hidden={true} />;
                    })()}
                    <span>
                      <strong>{item.displayName}</strong>
                      <small>{nodeLabels[item.nodeFamily]}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="blueprint-context-actions">
                {(["capability", "job", "work_target", "condition", "result"] as const).map(
                  (kind) => (
                    <button type="button" key={kind} onClick={() => setStubKind(kind)}>
                      <Plus aria-hidden="true" /> New {titleCase(kind)}
                    </button>
                  ),
                )}
                <button type="button" onClick={runAutoLayout}>
                  <ArrowsClockwise aria-hidden="true" /> Auto-layout
                </button>
                <button type="button" onClick={() => setAnnotationKind("comment")}>
                  <NotePencil aria-hidden="true" /> Comment
                </button>
                <button type="button" onClick={() => setAnnotationKind("group")}>
                  <Selection aria-hidden="true" /> Group
                </button>
                <button type="button" onClick={() => void pasteRecord()}>
                  <ClipboardText aria-hidden="true" /> Paste record ID
                </button>
              </div>
              {stubKind ? (
                <form
                  className="blueprint-stub-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createStub();
                  }}
                >
                  <label className="field-label">
                    Draft {titleCase(stubKind)} name
                    <input
                      autoFocus
                      value={stubName}
                      onChange={(event) => setStubName(event.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    Draft description
                    <textarea
                      maxLength={1000}
                      rows={3}
                      value={stubDescription}
                      onChange={(event) => setStubDescription(event.target.value)}
                    />
                    <small>You may finish this in the selected-card inspector before Apply.</small>
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={!stubName.trim()}
                  >
                    Create draft stub
                  </button>
                </form>
              ) : null}
              {annotationKind ? (
                <form
                  className="blueprint-stub-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addAnnotation();
                  }}
                >
                  <label className="field-label">
                    {annotationKind === "group" ? "Group label" : "Shared comment"}
                    <textarea
                      autoFocus
                      maxLength={4000}
                      rows={3}
                      value={annotationBody}
                      onChange={(event) => setAnnotationBody(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={!annotationBody.trim()}
                  >
                    Stage {annotationKind}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="blueprint-outline" aria-label="Accessible Blueprint outline">
          <section className="blueprint-outline-builder" aria-labelledby="outline-builder-heading">
            <h3 id="outline-builder-heading">Add records and relationships</h3>
            <p>This keyboard-first editor stages the same change set as the canvas.</p>
            <label className="field-label">
              Search record catalog
              <input
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
              />
            </label>
            {filteredLibrary.length ? (
              <ul className="blueprint-outline-library">
                {filteredLibrary.slice(0, 6).map((item) => (
                  <li key={item.publicId}>
                    <button type="button" onClick={() => addLibraryItem(item)}>
                      <Plus aria-hidden="true" /> Add {item.displayName} ·{" "}
                      {nodeLabels[item.nodeFamily]}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="blueprint-outline-connection">
              <label className="field-label">
                Relationship
                <select
                  value={outlineKind}
                  onChange={(event) => {
                    setOutlineKind(event.target.value as BlueprintRelationshipKind);
                    setOutlineSource("");
                    setOutlineTarget("");
                  }}
                >
                  {Object.entries(relationshipLabels).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                From
                <select
                  value={outlineSource}
                  onChange={(event) => setOutlineSource(event.target.value)}
                >
                  <option value="">Select source</option>
                  {nodes
                    .filter((node) =>
                      relationshipNodeFamilies[outlineKind].source.includes(
                        node.data.blueprint.nodeFamily,
                      ),
                    )
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.data.blueprint.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field-label">
                To
                <select
                  value={outlineTarget}
                  onChange={(event) => setOutlineTarget(event.target.value)}
                >
                  <option value="">Select target</option>
                  {nodes
                    .filter((node) =>
                      relationshipNodeFamilies[outlineKind].target.includes(
                        node.data.blueprint.nodeFamily,
                      ),
                    )
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.data.blueprint.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="button button-secondary"
                type="button"
                disabled={!outlineSource || !outlineTarget}
                onClick={() => {
                  const metadata: StudioObject =
                    outlineKind === "has_capability"
                      ? { tier: 1, tier_label: "Basic" }
                      : outlineKind === "requires_capability"
                        ? { minimum_tier: 1 }
                        : {};
                  stageRelationship(outlineSource, outlineTarget, outlineKind, metadata);
                  setOutlineSource("");
                  setOutlineTarget("");
                }}
              >
                <Graph aria-hidden="true" /> Stage relationship
              </button>
            </div>
          </section>
          <section>
            <h3>Nodes</h3>
            <ul>
              {nodes.map((node) => {
                const Icon = nodeIcons[node.data.blueprint.nodeFamily];
                return (
                  <li key={node.id}>
                    <button type="button" onClick={() => setSelectedId(node.id)}>
                      <Icon aria-hidden={true} />
                      <span>
                        <strong>{node.data.blueprint.displayName}</strong>
                        <small>{nodeLabels[node.data.blueprint.nodeFamily]}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h3>Relationships</h3>
            <ol>
              {edges.map((edge) => {
                const data = edge.data?.blueprint;
                return (
                  <li key={edge.id} data-outdated={data?.inheritanceState === "outdated"}>
                    <button type="button" onClick={() => setSelectedId(edge.id)}>
                      <strong>{data?.label}</strong>
                      <span>
                        {nodeById.get(edge.source)?.data.blueprint.displayName ?? edge.source} →{" "}
                        {nodeById.get(edge.target)?.data.blueprint.displayName ?? edge.target}
                      </span>
                    </button>
                    {data?.inheritanceDecision ? (
                      <label>
                        Evolution review
                        <select
                          value={data.inheritanceDecision}
                          onChange={(event) =>
                            setInheritanceDecision(edge, event.target.value as InheritanceDecision)
                          }
                        >
                          {inheritanceOptions.map((option) => (
                            <option key={option} value={option}>
                              {titleCase(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}

      {selectedNode || selectedEdge ? (
        <aside className="blueprint-selection-inspector" aria-label="Selected Blueprint item">
          <header>
            <strong>
              {selectedNode
                ? selectedNode.data.blueprint.displayName
                : selectedEdge?.data?.blueprint.label}
            </strong>
            <button
              type="button"
              aria-label="Close selection inspector"
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
          </header>
          {selectedNode ? (
            <>
              <span>{nodeLabels[selectedNode.data.blueprint.nodeFamily]}</span>
              <code>{selectedNode.id}</code>
              <StatusLamp
                tone={selectedNode.data.blueprint.workflowState === "approved" ? "green" : "amber"}
                label={selectedNode.data.blueprint.workflowState.replaceAll("_", " ")}
              />
              {selectedNode.data.blueprint.data.draft_stub === true ? (
                <label className="field-label">
                  Required draft description
                  <textarea
                    maxLength={1000}
                    rows={4}
                    value={String(selectedNode.data.blueprint.data.description ?? "")}
                    onChange={(event) =>
                      updateDraftStubDescription(selectedNode, event.target.value)
                    }
                  />
                </label>
              ) : null}
              <p>
                Removing this card only removes it from this board. It never deletes the record.
              </p>
            </>
          ) : null}
          {selectedEdge?.data?.blueprint ? (
            <>
              <span>{relationshipLabels[selectedEdge.data.blueprint.relationshipKind]}</span>
              <code>{selectedEdge.id}</code>
              <StatusLamp
                tone={selectedEdge.data.blueprint.workflowState === "approved" ? "green" : "amber"}
                label={selectedEdge.data.blueprint.workflowState.replaceAll("_", " ")}
              />
              {selectedEdge.data.blueprint.relationshipKind === "has_capability" ? (
                <label className="field-label">
                  Capability tier
                  <select
                    value={Number(selectedEdge.data.blueprint.metadata.tier ?? 1)}
                    onChange={(event) =>
                      setCapabilityTier(selectedEdge, Number(event.target.value))
                    }
                  >
                    <option value={1}>Tier 1 — Basic</option>
                    <option value={2}>Tier 2 — Capable</option>
                    <option value={3}>Tier 3 — Advanced</option>
                    <option value={4}>Tier 4 — Exceptional</option>
                  </select>
                </label>
              ) : null}
              {selectedEdge.data.blueprint.inheritanceDecision ? (
                <label className="field-label">
                  Evolution review
                  <select
                    value={selectedEdge.data.blueprint.inheritanceDecision}
                    onChange={(event) =>
                      setInheritanceDecision(
                        selectedEdge,
                        event.target.value as InheritanceDecision,
                      )
                    }
                  >
                    {inheritanceOptions.map((option) => (
                      <option key={option} value={option}>
                        {titleCase(option)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          <button
            className="button button-primary"
            type="button"
            disabled={
              dirty ||
              isApproving ||
              (selectedNode?.data.blueprint.recordRevision ??
                selectedEdge?.data?.blueprint.recordRevision ??
                0) < 1 ||
              (selectedNode?.data.blueprint.workflowState ??
                selectedEdge?.data?.blueprint.workflowState) === "approved" ||
              selectedNode?.data.blueprint.data.needs_completion === true
            }
            onClick={approveSelectedRecord}
          >
            <CheckCircle aria-hidden="true" />
            {(selectedNode?.data.blueprint.workflowState ??
              selectedEdge?.data?.blueprint.workflowState) === "approved"
              ? "Approved"
              : isApproving
                ? "Approving…"
                : "Approve exact revision"}
          </button>
          {dirty ? (
            <p className="source-note">Apply staged board changes before approving a record.</p>
          ) : null}
          <button
            className="button button-secondary"
            type="button"
            onClick={removeSelectedFromBoard}
          >
            <Trash aria-hidden="true" /> Remove from board
          </button>
          {selectedEdge && !selectedEdge.id.includes("/draft-") ? (
            <button
              className="button button-danger"
              type="button"
              onClick={archiveSelectedRelationship}
            >
              <Trash aria-hidden="true" /> Archive relationship
            </button>
          ) : null}
        </aside>
      ) : null}

      <section className="blueprint-validation" data-open={validationOpen}>
        <button
          type="button"
          aria-expanded={validationOpen}
          onClick={() => setValidationOpen((open) => !open)}
        >
          {hasErrors ? <WarningCircle aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
          <strong>Validation</strong>
          <span>
            {findings.length
              ? `${findings.length} finding${findings.length === 1 ? "" : "s"}`
              : "Ready to apply"}
          </span>
        </button>
        {validationOpen ? (
          findings.length ? (
            <ul>
              {findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(finding.relationshipPublicId ?? finding.recordPublicId ?? null)
                    }
                  >
                    <strong>{titleCase(finding.code)}</strong>
                    <span>{finding.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No duplicate relationships, missing targets, cycles, or invalid tiers detected.</p>
          )
        ) : null}
      </section>
    </section>
  );
}
