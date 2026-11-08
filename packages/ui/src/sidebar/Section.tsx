import { useState, type ReactNode } from "react";

/** Collapsible sidebar section. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="sb-sec">
      <button className="sb-tit" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}
