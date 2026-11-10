# Design: Transcript playback

Status: implemented in v0.1.

Active paragraph sync is one requestAnimationFrame loop reading refs (`useActiveSync`); `lineAt` is a forward scan in core. Media is served by `app-media://` with a manual Range handler (ADR 0007).

Related: [architecture](../../../docs/architecture.md), [roadmap](../../../ROADMAP.md).
