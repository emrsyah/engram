"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);

  return (
    <>
      {parts.map((part, index) => {
        if (!isUrl(part)) return part;
        const href = part.startsWith("http") ? part : `https://${part}`;
        return (
          <PreviewLink key={`${part}-${index}`} href={href} label={part} />
        );
      })}
    </>
  );
}

function PreviewLink({ href, label }: { href: string; label: string }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const domain = getDomain(href);

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({
            x: Math.min(rect.left, window.innerWidth - 320),
            y: Math.max(12, rect.top - 230),
          });
        }}
        onMouseLeave={() => setPosition(null)}
        className="nodrag nopan cursor-pointer text-teal underline decoration-teal/35 underline-offset-2 hover:text-p3-ink"
      >
        {label}
      </a>
      {position &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-[300px] overflow-hidden rounded-[8px] border border-line-2 bg-base shadow-2xl shadow-black/50"
            style={{ left: position.x, top: position.y }}
          >
            <div className="h-[150px] overflow-hidden border-surface border-b bg-sunken">
              <iframe
                src={href}
                title={domain}
                loading="lazy"
                sandbox=""
                className="h-[600px] w-[1200px] origin-top-left scale-[0.25] border-0 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt=""
                className="size-4 rounded-[3px]"
              />
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink text-xs">{domain}</div>
                <div className="truncate text-ink-muted text-[11px]">{href}</div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function isUrl(value: string) {
  return /^(https?:\/\/|www\.)/i.test(value);
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
