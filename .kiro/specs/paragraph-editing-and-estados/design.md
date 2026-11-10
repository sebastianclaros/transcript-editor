# Design: Paragraph editing and estados

Status: implemented in v0.1.

All transitions are pure functions in `core/estado.ts` that map over the array; property tests cover the paragraph-count invariant from the raw and clean entry paths.

Related: [architecture](../../../docs/architecture.md), [roadmap](../../../ROADMAP.md).
