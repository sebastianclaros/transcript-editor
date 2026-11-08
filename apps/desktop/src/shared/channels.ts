// Channel names only (no imports): used by main AND preload.
export const CH = {
  appGetInfo: "host:app:get-info",
  settingsGet: "host:settings:get",
  settingsUpdate: "host:settings:update",
  recentsRemove: "host:recents:remove",
  recentsClear: "host:recents:clear",
  projectPickFolder: "host:project:pick-folder",
  projectOpenRecent: "host:project:open-recent",
  projectOpenSample: "host:project:open-sample",
  projectClose: "host:project:close",
  projectListFiles: "host:project:list-files",
  projectReadText: "host:project:read-text",
  projectWriteText: "host:project:write-text",
  projectExists: "host:project:exists",
  projectMediaUrl: "host:project:media-url",
  sessionGet: "host:session:get",
  sessionSave: "host:session:save",
  externalOpen: "host:external:open",
  updatesCheck: "host:updates:check",
  closeDialogOpen: "host:lifecycle:close-dialog-open",
  respondToClose: "host:lifecycle:respond-to-close",
  // main -> renderer
  eventMenuCommand: "host:event:menu-command",
  eventCloseRequested: "host:event:close-requested",
  eventUpdateStatus: "host:event:update-status",
} as const;

export type InvokeChannel = Exclude<
  (typeof CH)[keyof typeof CH],
  "host:event:menu-command" | "host:event:close-requested" | "host:event:update-status"
>;
