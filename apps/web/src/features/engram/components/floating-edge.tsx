"use client";

import {
  BaseEdge,
  type EdgeProps,
  type InternalNode,
  type Node,
  useInternalNode,
} from "@xyflow/react";

/**
 * A center-to-center connector between two Item nodes.
 *
 * Edges in Engram join card centers (not handles), so this floating edge reads
 * each node's absolute position and measured size from React Flow and draws the
 * same horizontal-tangent cubic the original SVG connector used.
 */

function center(node: InternalNode<Node>) {
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  return { x: x + width / 2, y: y + height / 2 };
}

export function FloatingEdge({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const from = center(sourceNode);
  const to = center(targetNode);
  const midX = from.x + (to.x - from.x) / 2;
  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

  return (
    <>
      <path d={path} fill="none" stroke="#050504" strokeOpacity={0.55} strokeWidth={9} />
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: "#9b88ff", strokeOpacity: 0.85, strokeWidth: 2.5 }}
      />
    </>
  );
}
