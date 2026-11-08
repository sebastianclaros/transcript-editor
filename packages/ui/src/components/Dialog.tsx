import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  title: string;
  /** Called on Esc and on backdrop click. */
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Id of the element that should receive initial focus (defaults to the first button). */
  initialFocus?: string;
  /** When true the backdrop click does not close (destructive choices). */
  modalStrict?: boolean;
  labelId?: string;
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Modal dialog: role=dialog, aria-modal, Esc closes, focus trapped and restored. */
export function Dialog({
  title,
  onClose,
  children,
  wide,
  initialFocus,
  modalStrict,
  labelId,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = labelId ?? "dialog-title";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const target =
      (initialFocus ? root?.querySelector<HTMLElement>(`#${initialFocus}`) : null) ??
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [initialFocus]);

  return (
    <div
      className="modal-fondo"
      role="presentation"
      onClick={(e) => {
        if (!modalStrict && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal" + (wide ? " ancho" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
