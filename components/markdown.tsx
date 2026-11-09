"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/components/ui";

const TASK_MARKER = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

/** Flip the `[ ]` / `[x]` marker of the task-list item that starts at `offset` in `source`. */
function toggleTaskAt(source: string, offset: number): string | null {
  const rest = source.slice(offset);
  const m = rest.match(TASK_MARKER);
  if (!m) return null;
  const next = m[2] === " " ? "x" : " ";
  return source.slice(0, offset) + m[1] + next + m[3] + rest.slice(m[0].length);
}

/**
 * Renders note markdown (GitHub-flavoured: tables, task lists, strikethrough, autolinks).
 * Raw HTML in the source is not rendered.
 *
 * - `compact`: for previews inside a clickable card, where links and checkboxes must not be
 *   interactive (they would be nested inside a <button>).
 * - `onChange`: when given, task-list checkboxes are clickable and report the updated source.
 */
export function Markdown({
  source,
  compact,
  onChange,
  className,
}: {
  source: string;
  compact?: boolean;
  onChange?: (next: string) => void;
  className?: string;
}) {
  const interactive = !compact && !!onChange;

  const components: Components = {
    a: ({ href, title, children }) =>
      compact ? (
        <span className="md-link">{children}</span>
      ) : (
        <a href={href} title={title} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    input: ({ type, checked }) => {
      if (type !== "checkbox") return null;
      if (!interactive) return <span className={cn("md-check", checked && "md-check-on")} aria-hidden />;
      return <input type="checkbox" checked={!!checked} onChange={() => {}} aria-label={checked ? "Mark as not done" : "Mark as done"} />;
    },
    li: ({ node, className: liClass, children, ...rest }) => {
      const isTask = typeof liClass === "string" && liClass.includes("task-list-item");
      const offset = node?.position?.start.offset;
      return (
        <li
          className={liClass}
          {...rest}
          onClick={
            interactive && isTask && offset !== undefined
              ? (e) => {
                  if (!(e.target instanceof HTMLInputElement) || e.target.type !== "checkbox") return;
                  const next = toggleTaskAt(source, offset);
                  if (next !== null) onChange!(next);
                }
              : undefined
          }
        >
          {children}
        </li>
      );
    },
    // Wide content scrolls on its own instead of stretching the page.
    table: ({ children }) => (
      <div className="md-table">
        <table>{children}</table>
      </div>
    ),
  };

  return (
    <div className={cn("md", compact && "md-compact", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
