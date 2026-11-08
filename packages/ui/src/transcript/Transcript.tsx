import { useMemo } from "react";
import type { Paragraph, SpeakerInfo } from "@transcript-editor/core";
import { Line } from "./Line";

interface Props {
  paragraphs: Paragraph[];
  activeId: number | null;
  info: SpeakerInfo;
  colorText: boolean;
  onSeek: (sec: number) => void;
  onCycle: (id: number) => void;
  onEdit: (id: number, text: string) => void;
  register: (id: number, node: HTMLDivElement | null) => void;
}

/** Fallback colours alternate by order of first appearance (`spk-0` / `spk-1`) when unmapped. */
export function Transcript({
  paragraphs,
  activeId,
  info,
  colorText,
  onSeek,
  onCycle,
  onEdit,
  register,
}: Props) {
  const order = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of paragraphs) if (p.speaker && !m.has(p.speaker)) m.set(p.speaker, m.size);
    return m;
  }, [paragraphs]);
  return (
    <>
      {paragraphs.map((p) => {
        const meta = info.get(p.speaker);
        const idx = order.get(p.speaker);
        return (
          <Line
            key={p.id}
            p={p}
            active={activeId === p.id}
            spkClass={idx === undefined ? "" : `spk-${idx % 2}`}
            label={meta?.label || p.speaker}
            color={meta?.color ?? null}
            colorText={colorText}
            onSeek={onSeek}
            onCycle={onCycle}
            onEdit={onEdit}
            register={register}
          />
        );
      })}
    </>
  );
}
