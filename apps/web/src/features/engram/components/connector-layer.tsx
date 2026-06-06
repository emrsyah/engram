"use client";

import type { Item, ItemLink } from "../types";

type ConnectorLayerProps = {
  items: Item[];
  links: ItemLink[];
  onDeleteLink: (id: string) => void;
};

export function ConnectorLayer({ items, links, onDeleteLink }: ConnectorLayerProps) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={2400} height={1600}>
      {links.map((link) => {
        const from = itemMap.get(link.fromItemId);
        const to = itemMap.get(link.toItemId);
        if (!from || !to) {
          return null;
        }

        const startX = from.x + from.width / 2;
        const startY = from.y + from.height / 2;
        const endX = to.x + to.width / 2;
        const endY = to.y + to.height / 2;
        const midX = startX + (endX - startX) / 2;
        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

        return (
          <g key={link.id}>
            <path d={path} fill="none" stroke="#15130f" strokeOpacity="0.35" strokeWidth="8" />
            <path
              d={path}
              fill="none"
              stroke="#534b91"
              strokeOpacity="0.55"
              strokeWidth="2"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onDeleteLink(link.id)}
            />
          </g>
        );
      })}
    </svg>
  );
}
