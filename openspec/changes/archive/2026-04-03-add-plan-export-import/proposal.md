## Why

Users have no way to share a floorplan project with others or back it up externally. Exporting to a portable file and importing it into another instance enables sharing, backup, and migration.

## What Changes

- Add an **Export** button to the toolbar that downloads the current plan as a `.fpjson` file (JSON with all images embedded as base64).
- Add an **Import** button to the toolbar that accepts a `.fpjson` file and saves it as a new plan, then loads it into the editor.
- Add a new server API endpoint `POST /api/plans/import` that receives the JSON payload and persists it using the existing save logic.

## Capabilities

### New Capabilities

- `plan-export-import`: Export the current plan to a `.fpjson` file and import a `.fpjson` file as a new plan.

### Modified Capabilities

<!-- No existing spec-level behavior changes. -->

## Impact

- **New API route**: `app/routes/api.plans.import.ts` (POST) — accepts a `LoadedPlan`-shaped JSON body and saves it as a new plan.
- **Toolbar**: `app/components/Toolbar.tsx` — two new buttons (Export, Import).
- **Queries**: `app/db/queries.ts` — reuses existing `savePlan` logic; no schema changes.
- **No dependencies added** — export is pure client-side (`JSON.stringify` + Blob download); import uses the existing fetch + save pipeline.
