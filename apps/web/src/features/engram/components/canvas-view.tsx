"use client";

import { Button } from "@alphonse/ui/components/button";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import { CanvasCard } from "./canvas-card";
import { ConnectorLayer } from "./connector-layer";
import { Icons } from "./icons";
import { useEngramStore } from "../store";

export function CanvasView() {
  const {
    activeItems,
    activeLinks,
    activeViewState,
    activeSpaceId,
    setViewState,
    createItem,
    deleteLink,
  } = useEngramStore();
  const [panning, setPanning] = useState(false);
  const panRef = useRef({ pointerId: 0, startX: 0, startY: 0, panX: 0, panY: 0 });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: activeViewState.panX,
      panY: activeViewState.panY,
    };
    setPanning(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning || panRef.current.pointerId !== event.pointerId) {
      return;
    }

    setViewState(activeSpaceId, {
      panX: panRef.current.panX + event.clientX - panRef.current.startX,
      panY: panRef.current.panY + event.clientY - panRef.current.startY,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current.pointerId === event.pointerId) {
      setPanning(false);
    }
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - activeViewState.panX) / activeViewState.zoom;
    const y = (event.clientY - rect.top - activeViewState.panY) / activeViewState.zoom;
    createItem({ type: "thought", text: "Untitled thought", x: Math.round(x), y: Math.round(y) });
  };

  const setZoom = (delta: number) => {
    const zoom = Math.min(2.2, Math.max(0.35, Number((activeViewState.zoom + delta).toFixed(2))));
    setViewState(activeSpaceId, { zoom });
  };

  return (
    <section
      className="engram-grid relative h-full overflow-hidden bg-[#141210]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="absolute left-0 top-0 h-[1600px] w-[2400px] origin-top-left"
        style={{
          transform: `translate(${activeViewState.panX}px, ${activeViewState.panY}px) scale(${activeViewState.zoom})`,
        }}
      >
        <ConnectorLayer items={activeItems} links={activeLinks} onDeleteLink={deleteLink} />
        {activeItems.map((item) => (
          <CanvasCard key={item.id} item={item} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-5 rounded-[8px] bg-[#181511]/70 px-4 py-2 text-[#8d857b] text-xs backdrop-blur">
          <span>Double-click to add a thought</span>
          <span>Drag the canvas to pan</span>
          <span>Press <kbd className="rounded bg-[#2b2722] px-1.5 py-0.5 font-mono">N</kbd> to capture</span>
        </div>
      </div>

      <div className="absolute right-5 bottom-5 flex items-center gap-2 rounded-[8px] border border-[#34302b] bg-[#211e1a] p-2">
        <Button variant="ghost" size="icon-xs" onClick={() => setZoom(-0.1)}>
          <Icons.minus className="size-4" />
        </Button>
        <span className="w-12 text-center font-mono text-[#c6bdb2] text-xs">
          {Math.round(activeViewState.zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-xs" onClick={() => setZoom(0.1)}>
          <Icons.plus className="size-4" />
        </Button>
      </div>
    </section>
  );
}
