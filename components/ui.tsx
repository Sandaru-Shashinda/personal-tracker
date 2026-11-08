"use client";

import { Plus, X } from "lucide-react";
import { forwardRef, useEffect, useId, useRef } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-[color,background-color,border-color,transform] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" && "h-9 px-3 text-sm sm:h-8",
        size === "md" && "h-11 px-4 text-sm sm:h-10",
        size === "icon" && "size-10 sm:size-9",
        variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
        variant === "secondary" && "border border-border bg-surface text-text hover:bg-surface-2",
        variant === "ghost" && "text-text-2 hover:bg-surface-2 hover:text-text",
        variant === "danger" && "bg-bad text-white hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-3 sm:h-10 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text sm:h-10 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, hint, className }: { children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <span className={cn("mb-1.5 flex items-baseline justify-between text-sm font-medium text-text-2", className)}>
      {children}
      {hint && <span className="text-xs font-normal text-text-3">{hint}</span>}
    </span>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-4 sm:p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action, sub }: { children: React.ReactNode; action?: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-text">{children}</h2>
        {sub && <p className="mt-0.5 text-xs text-text-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { ref, handlers: swipe } = useSwipeToClose<HTMLDialogElement>(onClose);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // Clear any offset left over from a swipe-to-close.
      d.style.transform = "";
      d.style.transition = "";
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, ref]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={cn(
        // Phones: a full-width bottom sheet. Larger screens: a centered card.
        "sheet m-auto max-h-none w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[90dvh]">
          <div className="shrink-0 px-5 pt-2 max-sm:touch-none sm:pt-5" {...swipe}>
            <div className="mx-auto mb-1.5 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-3 pb-3">
              <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold">
                {title}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2">
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Drag a bottom sheet down by its header to dismiss it. Attach `ref` to the element that moves and
 * spread `handlers` on the drag area.
 */
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const startY = useRef<number | null>(null);
  const dy = useRef(0);
  const handlers = {
    onTouchStart(e: React.TouchEvent) {
      startY.current = e.touches[0].clientY;
      dy.current = 0;
      const el = ref.current;
      if (el) el.style.transition = "none";
    },
    onTouchMove(e: React.TouchEvent) {
      if (startY.current === null) return;
      dy.current = Math.max(0, e.touches[0].clientY - startY.current);
      const el = ref.current;
      if (el) el.style.transform = dy.current ? `translateY(${dy.current}px)` : "";
    },
    onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      const el = ref.current;
      if (dy.current > 80) return onClose();
      if (el) {
        el.style.transition = "transform 200ms ease-out";
        el.style.transform = "";
      }
    },
  };
  return { ref, handlers };
}

/** Floating "add" button for phones, sitting above the bottom tab bar in easy thumb reach. */
export function Fab({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-black/25 transition-transform active:scale-95 md:hidden"
    >
      {icon ?? <Plus className="size-6" strokeWidth={2.5} aria-hidden />}
    </button>
  );
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-3 text-text-3">{icon}</div>
      <p className="font-medium text-text">{title}</p>
      {children && <div className="mt-1 text-sm text-text-3">{children}</div>}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-2">
          #{t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-text-3"
        placeholder={value.length ? "" : (placeholder ?? "Add tags, press Enter")}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if ((e.key === "Enter" || e.key === ",") && el.value.trim()) {
            e.preventDefault();
            const tag = el.value.trim().replace(/^#/, "").toLowerCase();
            if (!value.includes(tag)) onChange([...value, tag]);
            el.value = "";
          } else if (e.key === "Backspace" && !el.value && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

export const COLORS = [
  "#2a78d6",
  "#6250d6",
  "#e87ba4",
  "#e34948",
  "#eb6834",
  "#eda100",
  "#1baf7a",
  "#008300",
  "#0ea5e9",
  "#64748b",
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          aria-pressed={value === c}
          className={cn(
            "size-7 rounded-full ring-offset-2 ring-offset-surface transition",
            value === c ? "ring-2 ring-text" : "hover:scale-110",
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
