## 1. API — Import endpoint

- [x] 1.1 Create `app/routes/api.plans.import.ts` — POST route that accepts a `LoadedPlan` JSON body, assigns a new UUID, calls `savePlan`, and returns `{ id, name }`
- [x] 1.2 Add basic validation: reject requests missing required top-level fields (`formatVersion`, `name`, `floors`, `corners`, `walls`) with a 400 response

## 2. Export — client-side utility

- [x] 2.1 Add an `exportPlan()` helper (inline in Toolbar or small util) that reads the current plan from the store, adds `formatVersion: 1`, serializes to JSON, and triggers a browser download as `<planName>.fpjson`

## 3. Import — client-side flow

- [x] 3.1 Add a hidden `<input type="file" accept=".fpjson">` in the Toolbar and wire it to a handler that reads the file, POSTs to `/api/plans/import`, then reloads the page (or hydrates the store with the returned plan)

## 4. Toolbar UI

- [x] 4.1 Add **Export** button to the toolbar that calls `exportPlan()`
- [x] 4.2 Add **Import** button to the toolbar that triggers the file input click
- [x] 4.3 Show a brief error message if the import request returns a non-OK response
