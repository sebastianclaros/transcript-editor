import { z } from "zod";

/** Renderer-supplied part of the per-project session memory (IPC input, strict). */
export const SessionStateInputSchema = z
  .object({
    audioName: z.string().max(255),
    positionSec: z.number().min(0).max(1e6),
    activeParagraphId: z.number().int().min(0).nullable(),
    playbackRate: z.number().min(0.25).max(4).optional(),
  })
  .strict();
export type SessionStateInput = z.infer<typeof SessionStateInputSchema>;

/** Stored record: input plus fields main fills in itself. */
export const SessionStateSchema = z.object({
  path: z.string().max(4096),
  lastOpenedAt: z.string().datetime(),
  audioName: z.string().max(255),
  positionSec: z.number().min(0).max(1e6).catch(0),
  activeParagraphId: z.number().int().min(0).nullable().catch(null),
  playbackRate: z.number().min(0.25).max(4).optional(),
  updatedAt: z.string().datetime(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

const KEY_RE = /^[0-9a-f]{32}$/;
export const MAX_STATE_PROJECTS = 200;

export const StateFileSchema = z
  .object({
    version: z.number().int().min(1).catch(1),
    projects: z
      .record(z.string(), z.unknown())
      .catch({})
      .transform((rec) => {
        const out: Record<string, SessionState> = {};
        for (const [k, v] of Object.entries(rec)) {
          if (!KEY_RE.test(k)) continue;
          const parsed = SessionStateSchema.safeParse(v);
          if (parsed.success) out[k] = parsed.data;
        }
        return out;
      }),
  })
  .passthrough();
export type StateFile = z.infer<typeof StateFileSchema>;

export function defaultState(): StateFile {
  return StateFileSchema.parse({});
}

/** Keeps the most recently opened `MAX_STATE_PROJECTS` entries. */
export function pruneState(state: StateFile): StateFile {
  const entries = Object.entries(state.projects);
  if (entries.length <= MAX_STATE_PROJECTS) return state;
  entries.sort((a, b) => Date.parse(b[1].lastOpenedAt) - Date.parse(a[1].lastOpenedAt));
  return { ...state, projects: Object.fromEntries(entries.slice(0, MAX_STATE_PROJECTS)) };
}

/**
 * Whether a saved position can be applied to the currently loaded audio. Resume is ignored when
 * the audio name changed or the position is past the end.
 */
export function canResume(
  saved: SessionState | null | undefined,
  audioName: string,
  duration: number,
): boolean {
  if (!saved || saved.audioName !== audioName) return false;
  return Number.isFinite(duration) && duration > 0 ? saved.positionSec < duration : false;
}
