## Context

The app stores plans in a local SQLite database. There is no built-in way to transfer a plan to another person or instance. The existing `loadPlanById` query already returns a complete, self-contained `LoadedPlan` object (all geometry + images as base64), which can be serialized directly to JSON without any data transformation.

## Goals / Non-Goals

**Goals:**
- Export the current plan to a single `.fpjson` file (JSON with embedded base64 images).
- Import a `.fpjson` file as a new plan and immediately open it in the editor.
- No new dependencies. No schema changes.

**Non-Goals:**
- Sharing via URL or link.
- Exporting images as separate files (ZIP).
- Versioned format migration — v1 only.
- Exporting multiple plans at once.

## Decisions

**Decision: Reuse `LoadedPlan` as the export format**
The `LoadedPlan` type returned by `loadPlanById` already captures everything needed. Exporting it directly means the import path is just the existing `hydratePlan` store method + `savePlan` DB call — no new serialization logic. Alternative (a custom slimmer format) would require mapping code and risk drifting out of sync.

**Decision: Import via a new `POST /api/plans/import` server route**
The existing `POST /api/plans/save` route expects a slightly different shape (it takes the Zustand store's serialized state). A dedicated import route accepts the `LoadedPlan` JSON directly and calls `savePlan` after assigning a new UUID, avoiding ID collisions.

**Decision: Export is pure client-side**
`JSON.stringify` the store state (already serializable), create a `Blob`, and trigger a download via a temporary anchor element. No server round-trip needed for export.

**Decision: Import assigns a new plan ID**
When importing, always generate a fresh UUID. This prevents collisions when the same file is imported multiple times or imported into a different instance.

## Risks / Trade-offs

- **Large images**: Base64-encoded images can make `.fpjson` files large (several MB). No mitigation needed at this stage — it's a known trade-off of the single-file approach.
- **Format compatibility**: If the schema evolves, older `.fpjson` files may fail to import. Mitigation: include a `formatVersion` field in the export so future code can detect and handle mismatches.

## Open Questions

- Should the export filename default to the plan name (e.g., `my-house.fpjson`) or a timestamp? → Plan name, falling back to `floorplan.fpjson`.
