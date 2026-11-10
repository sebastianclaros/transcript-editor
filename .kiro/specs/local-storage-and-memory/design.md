# Design: Local storage and memory

Status: implemented in v0.1.

ConfigStore and StateStore in main with debounced atomic writes; the renderer persists speed, sidebar and auto-scroll, and the position every 5 s, on pause and on close. `drive.rootFolderId` is reserved for later.

Related: [architecture](../../../docs/architecture.md), [roadmap](../../../ROADMAP.md).
