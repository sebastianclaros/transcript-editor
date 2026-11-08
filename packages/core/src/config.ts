import { z } from "zod";

export const RecentProjectSchema = z.object({
  key: z.string().regex(/^[0-9a-f]{32}$/),
  path: z.string().min(1).max(4096),
  name: z.string().max(255),
  lastOpenedAt: z.string().datetime(),
});
export type RecentProject = z.infer<typeof RecentProjectSchema>;

export const MAX_RECENTS = 10;

/** Newest first, first occurrence per key wins, capped at 10. Stable for equal dates. */
export function dedupeRecents(rows: readonly RecentProject[]): RecentProject[] {
  const stamped = rows.map((r, i) => ({ r, i, t: Date.parse(r.lastOpenedAt) }));
  stamped.sort((a, b) => {
    const ta = Number.isNaN(a.t) ? 0 : a.t;
    const tb = Number.isNaN(b.t) ? 0 : b.t;
    return tb - ta || a.i - b.i;
  });
  const seen = new Set<string>();
  const out: RecentProject[] = [];
  for (const { r } of stamped) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out.slice(0, MAX_RECENTS);
}

export const ConfigSchema = z
  .object({
    version: z.number().int().min(1).catch(1),
    language: z.enum(["es", "en"]).catch("es"),
    theme: z.enum(["dark"]).catch("dark"),
    lastProject: RecentProjectSchema.nullable().catch(null),
    recentProjects: z
      .array(z.unknown())
      .catch([])
      .transform((rows) =>
        dedupeRecents(
          rows.flatMap((r) => {
            const p = RecentProjectSchema.safeParse(r);
            return p.success ? [p.data] : [];
          }),
        ),
      ),
    window: z
      .object({
        width: z.number().int().min(640).max(10000).catch(1280),
        height: z.number().int().min(480).max(10000).catch(800),
        x: z.number().int().optional().catch(undefined),
        y: z.number().int().optional().catch(undefined),
        maximized: z.boolean().catch(false),
      })
      .catch({ width: 1280, height: 800, maximized: false }),
    playbackRate: z.number().min(0.25).max(4).catch(1),
    sidebarCollapsed: z.boolean().catch(false),
    autoScroll: z.boolean().catch(true),
    drive: z
      .object({ rootFolderId: z.string().nullable().catch(null) })
      .passthrough()
      .catch({ rootFolderId: null }),
  })
  .passthrough();

export type Config = z.infer<typeof ConfigSchema>;
export const CONFIG_VERSION = 1;

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

/** Migration steps keyed by the version they upgrade FROM (empty in v0.1). */
const CONFIG_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> =
  {};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function migrateConfig(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  let v =
    typeof current.version === "number" && Number.isInteger(current.version) ? current.version : 0;
  while (v < CONFIG_VERSION) {
    const step = CONFIG_MIGRATIONS[v];
    current = step ? step(current) : current;
    v++;
    current = { ...current, version: v };
  }
  return current;
}

/** Tolerant parse. Returns null when the value is not a plain object (caller recovers). */
export function parseConfig(raw: unknown): Config | null {
  if (!isPlainObject(raw)) return null;
  return ConfigSchema.parse(migrateConfig(raw));
}

/** Keeps the larger version and every unknown key when writing back. */
export function serializeConfig(cfg: Config): string {
  return JSON.stringify({ ...cfg, version: Math.max(cfg.version, CONFIG_VERSION) }, null, 2) + "\n";
}

export const SettingsPatchSchema = z
  .object({
    language: z.enum(["es", "en"]),
    theme: z.enum(["dark"]),
    playbackRate: z.number().min(0.25).max(4),
    sidebarCollapsed: z.boolean(),
    autoScroll: z.boolean(),
  })
  .partial()
  .strict();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
