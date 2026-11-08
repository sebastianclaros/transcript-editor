// zod payload schemas for every invoke channel. Used by main ONLY (the preload stays tiny).
import { z } from "zod";
import { SessionStateInputSchema, SettingsPatchSchema } from "@transcript-editor/core";
import { CH, type InvokeChannel } from "./channels";

const key32 = z.string().regex(/^[0-9a-f]{32}$/);
const fileName = z.string().min(1).max(255);
const none = z.tuple([]);

export const MAX_TEXT_CHARS = 20 * 1024 * 1024;

export const SCHEMAS: Record<InvokeChannel, z.ZodTypeAny> = {
  [CH.appGetInfo]: none,
  [CH.settingsGet]: none,
  [CH.settingsUpdate]: z.tuple([SettingsPatchSchema]),
  [CH.recentsRemove]: z.tuple([key32]),
  [CH.recentsClear]: none,
  [CH.projectPickFolder]: none,
  [CH.projectOpenRecent]: z.tuple([key32]),
  [CH.projectOpenSample]: none,
  [CH.projectClose]: z.tuple([key32]),
  [CH.projectListFiles]: z.tuple([key32]),
  [CH.projectReadText]: z.tuple([key32, fileName]),
  [CH.projectWriteText]: z.tuple([
    key32,
    fileName,
    z.string().max(MAX_TEXT_CHARS),
    z
      .object({
        ifVersion: z
          .string()
          .regex(/^\d+(\.\d+)?:\d+$/)
          .optional(),
      })
      .strict()
      .optional(),
  ]),
  [CH.projectExists]: z.tuple([key32, fileName]),
  [CH.projectMediaUrl]: z.tuple([key32, fileName]),
  [CH.sessionGet]: z.tuple([key32]),
  [CH.sessionSave]: z.tuple([key32, SessionStateInputSchema]),
  [CH.externalOpen]: z.tuple([z.string().max(2048)]),
  [CH.updatesCheck]: none,
  [CH.closeDialogOpen]: z.tuple([z.boolean()]),
  [CH.respondToClose]: z.tuple([z.boolean()]),
};
