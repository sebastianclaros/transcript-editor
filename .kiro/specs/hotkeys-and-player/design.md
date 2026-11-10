# Design: Hotkeys and player

Status: implemented in v0.1.

Pure matcher `matchHotkey` and the `HOTKEYS` table in core; `useHotkeys` registers one window listener and reads actions from a ref; `usePlayer` holds the actions. Paragraph navigation starts playback; nudges and start-of-audio do not.

Related: [architecture](../../../docs/architecture.md), [roadmap](../../../ROADMAP.md).
