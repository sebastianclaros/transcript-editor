import { memo, type ClipboardEvent, type KeyboardEvent } from "react";
import { fmt, normalizeText, type Paragraph } from "@transcript-editor/core";
import { useT } from "../i18n/I18n";

export interface LineProps {
  p: Paragraph;
  active: boolean;
  spkClass: string;
  label: string;
  color: string | null;
  colorText: boolean;
  onSeek: (sec: number) => void;
  onCycle: (id: number) => void;
  onEdit: (id: number, text: string) => void;
  register: (id: number, node: HTMLDivElement | null) => void;
}

function insertPlainText(text: string) {
  const exec = (
    document as Document & { execCommand?: (cmd: string, ui: boolean, v: string) => boolean }
  ).execCommand;
  if (typeof exec === "function" && exec.call(document, "insertText", false, text)) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
}

/** One paragraph row. Memoized: playback and typing elsewhere do not re-render it. */
export const Line = memo(function Line({
  p,
  active,
  spkClass,
  label,
  color,
  colorText,
  onSeek,
  onCycle,
  onEdit,
  register,
}: LineProps) {
  const t = useT();
  const timed = p.seconds >= 0;
  return (
    <div
      ref={(n) => register(p.id, n)}
      className={`line ${spkClass} est-${p.estado} ${active ? "active" : ""}`}
      title={t("line.title", { estado: t(`estado.${p.estado}`) })}
      data-id={p.id}
    >
      {/* Time cell: mouse-only affordance. Keyboard users have the hotkeys and the minimap. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={"time" + (timed ? "" : " sin-tiempo")}
        title={timed ? t("line.timeTitle") : t("line.noTime")}
        onClick={() => onSeek(p.seconds)}
        onDoubleClick={() => onCycle(p.id)}
      >
        {fmt(p.seconds)}
      </div>
      <div className="body">
        {label && (
          <div className="speaker" style={color ? { color } : undefined}>
            {label}
          </div>
        )}
        <div
          className="text"
          style={color && colorText ? { color } : undefined}
          role="textbox"
          tabIndex={0}
          aria-multiline="false"
          aria-label={t("line.textLabel", { n: p.id + 1 })}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            // Enter inside a paragraph would add <div>/<br>; Ctrl/Cmd+Enter is the verify hotkey.
            if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onPaste={(e: ClipboardEvent<HTMLDivElement>) => {
            e.preventDefault();
            insertPlainText(normalizeText(e.clipboardData.getData("text/plain")));
          }}
          onBlur={(e) => {
            // One paragraph = one line: line breaks become a space; an empty result restores the old text.
            const node = e.currentTarget;
            const clean = normalizeText(node.textContent ?? "");
            if (!clean) {
              node.textContent = p.text;
              return;
            }
            if (clean !== node.textContent) node.textContent = clean;
            onEdit(p.id, clean);
          }}
        >
          {p.text}
        </div>
      </div>
    </div>
  );
});
