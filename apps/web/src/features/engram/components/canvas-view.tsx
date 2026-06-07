"use client";

import React from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type NodeChange,
  type OnSelectionChangeParams,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnMove,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useHotkeys } from "react-hotkeys-hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FloatingEdge } from "./floating-edge";
import { ItemNode, type ItemNodeType } from "./item-node";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";

const nodeTypes = { item: ItemNode };
const edgeTypes = { floating: FloatingEdge };

function CanvasInner() {
  const {
    activeItems,
    activeLinks,
    activeViewState,
    activeSpaceId,
    selectedItemId,
    setViewState,
    createItem,
    deleteLink,
    moveItem,
    connectItems,
  } = useEngramStore();
  const { linkSourceId, setLinkSource, openDetail, openNoteEditor, setCanvasSelectedId, setCanvasSelectedIds, canvasSelectedId, canvasSelectedIds, minimapVisible, toggleMinimap, detailItemId, closeDetail } = useUIStore();
  const { screenToFlowPosition, fitView, setCenter, getNode } = useReactFlow();

  const nodesRef = useRef<ItemNodeType[]>([]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId) ?? nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      const w = node.measured?.width ?? node.width ?? 200;
      const h = node.measured?.height ?? node.height ?? 100;
      const x = node.position.x + w / 2;
      const y = node.position.y + h / 2;
      setCenter(x, y, { duration: 350 });
    },
    [getNode, setCenter],
  );

  useHotkeys("escape", () => {
    if (detailItemId) { closeDetail(); return; }
    fitView({ duration: 400, padding: 0.1 });
  }, { enabled: !canvasSelectedId });

  useHotkeys("enter", () => {
    if (canvasSelectedId) { openDetail(canvasSelectedId); centerOnNode(canvasSelectedId); }
  }, { preventDefault: true, enabled: !!canvasSelectedId && !detailItemId });

  const itemsToNodes = useCallback(
    (items: typeof activeItems, selId?: string): ItemNodeType[] =>
      items.map((item) => ({
        id: item.id,
        type: "item",
        position: { x: item.x, y: item.y },
        data: { item },
        selected: item.id === selId,
        style: { width: item.width },
        initialWidth: item.width,
        initialHeight: item.height,
        zIndex: item.id === selId ? 1000 : 1,
      })),
    [],
  );

  const [nodes, setNodes] = useState<ItemNodeType[]>(() => itemsToNodes(activeItems, selectedItemId));
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Track which jump we've already applied so we don't re-apply on unrelated re-renders.
  const appliedJumpRef = useRef<string | undefined>(selectedItemId);

  useEffect(() => {
    if (selectedItemId && selectedItemId !== appliedJumpRef.current) {
      // New jump target: set selection + preserve everything else.
      appliedJumpRef.current = selectedItemId;
      setNodes(itemsToNodes(activeItems, selectedItemId));
      return;
    }
    // Normal sync (items added/moved/edited): preserve whatever RF has selected.
    setNodes((prev) => {
      const selectedIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      return itemsToNodes(activeItems, undefined).map((n) => ({
        ...n,
        selected: selectedIds.has(n.id),
        zIndex: selectedIds.has(n.id) ? 1000 : 1,
      }));
    });
  }, [activeItems, selectedItemId, itemsToNodes]);

  const edges = useMemo<Edge[]>(
    () =>
      activeLinks.map((link) => ({
        id: link.id,
        source: link.fromItemId,
        target: link.toItemId,
        type: "floating",
      })),
    [activeLinks],
  );

  const defaultViewport = useMemo<Viewport>(
    () => ({ x: activeViewState.panX, y: activeViewState.panY, zoom: activeViewState.zoom }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<ItemNodeType>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          moveItem(change.id, Math.round(change.position.x), Math.round(change.position.y));
        }
      }
    },
    [moveItem],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setCanvasSelectedIds(selectedNodes.map((n) => n.id));
    },
    [setCanvasSelectedIds],
  );

  const onMoveEnd = useCallback<OnMove>(
    (_, next: Viewport) => {
      setViewState(activeSpaceId, { panX: next.x, panY: next.y, zoom: next.zoom });
    },
    [activeSpaceId, setViewState],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.target as HTMLElement).classList.contains("react-flow__pane")) {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      createItem({
        type: "thought",
        text: "Untitled thought",
        x: Math.round(position.x),
        y: Math.round(position.y),
      });
    },
    [createItem, screenToFlowPosition],
  );

  return (
    <div className="h-full w-full bg-[#141210]" onDoubleClick={onDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        defaultViewport={defaultViewport}
        onMoveEnd={onMoveEnd}
        onNodeClick={(_, node) => {
          if (linkSourceId && linkSourceId !== node.id) {
            connectItems(linkSourceId, node.id);
            setLinkSource(undefined);
          }
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.data.item.type === "thought") {
            openNoteEditor(node.id);
          } else {
            openDetail(node.id);
          }
          centerOnNode(node.id);
        }}
        onEdgeClick={(_, edge) => deleteLink(edge.id)}
        nodesConnectable={false}
        minZoom={0.35}
        maxZoom={2.2}
        proOptions={{ hideAttribution: false }}
        deleteKeyCode={null}
        snapToGrid
        snapGrid={[28, 28]}
        panOnDrag
        zoomOnScroll
        selectionOnDrag
        selectionKeyCode="Shift"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <Controls
          showInteractive={false}
          style={{
            "--xy-controls-button-background-color-default": "#211e1a",
            "--xy-controls-button-background-color-hover-default": "#2e2b26",
            "--xy-controls-button-color-default": "#8a8378",
            "--xy-controls-button-border-color-default": "#34302b",
            "--xy-controls-box-shadow-default": "none",
          } as React.CSSProperties}
        />
        {minimapVisible && (
          <MiniMap
            pannable
            zoomable
            className="!bg-[#1a1714]"
            maskColor="rgba(10,10,9,0.6)"
            nodeColor="#534b91"
          />
        )}
        {linkSourceId && (
          <Panel position="top-center">
            <div className="rounded-[8px] border border-[#4d437a] bg-[#1c1828]/90 px-3 py-2 text-[#d9d1ff] text-sm shadow-lg backdrop-blur">
              Click another node to link
              <span className="ml-2 text-[#8f84bd]">Esc to cancel</span>
            </div>
          </Panel>
        )}
        <Panel position="bottom-right">
          <button
            type="button"
            onClick={toggleMinimap}
            className="flex items-center gap-1.5 rounded-[6px] bg-[#181511]/70 px-2.5 py-1.5 text-[11px] text-[#8d857b] backdrop-blur transition-colors hover:text-[#c8bfb2]"
          >
            {minimapVisible ? "Hide" : "Show"} minimap
            <kbd className="rounded-[4px] bg-[#2b2722] px-1.5 py-0.5 font-mono leading-none">M</kbd>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function CanvasView() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
