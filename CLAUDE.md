<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build
pnpm start            # Serve production build
pnpm typecheck        # Generate route types + run tsc
pnpm db:push          # Push Drizzle schema to SQLite
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run Drizzle migrations
pnpm db:studio        # Open Drizzle Studio GUI
```

No test framework is configured.

## Architecture

Interactive 3D floorplan editor: load an image, draw walls over it in 2D, preview in 3D. Built with React Router v7 (framework mode, SSR enabled), React Three Fiber, Zustand, Drizzle ORM + SQLite.

### Layers

- **State** — Single Zustand store (`app/store/useFloorplanStore.ts`) holds all editor state: corners, walls, rooms, floorplan image, draw mode, selection, history (undo/redo). This is the source of truth.
- **Rendering** — R3F scenes in `app/scene/`. `BuildScene` is orthographic top-down 2D; `PreviewScene` is perspective 3D. Both render inside a single `<Canvas>` in `app/routes/home.tsx`.
- **UI** — `app/components/Toolbar.tsx` (mode/tool switching, save/load) and `PropertiesPanel.tsx` (selected object editing).
- **Persistence** — Drizzle ORM with SQLite (`data/floorplan.db`). Schema in `app/db/schema.ts`, queries in `app/db/queries.ts`. API routes under `app/routes/api.plans.*`.

### Key patterns

- **Client-only R3F**: Never SSR R3F components. Never use R3F's `useLoader` — it unmounts the entire Canvas on suspend. Use imperative Three.js loaders in `useEffect` instead.
- **Coordinate system**: 2D floorplan `(x, y)` in meters maps to 3D world `(x, 0, z)` with Y-axis up. Walls extend along Y.
- **Wall geometry**: `app/scene/wallGeometryUtils.ts` computes mitered corner outlines used by both Wall2D and Wall3D.
- **Room detection**: `app/store/roomDetection.ts` uses a DCEL/half-edge algorithm to find closed wall cycles. Auto-triggers on wall/corner changes via Zustand subscription.
- **Snapping**: Grid snap, corner snap, and angle snap configurable in the store. Helpers: `findSnapCorner()`, `snapToGrid()`.
- **History**: Snapshots of `(corners, walls)` state, max 100 entries. Call `pushHistory()` before mutations.
- **Plan hydration**: `home.tsx` loader fetches the most recent plan server-side; `useHydrateStore()` pushes it into Zustand on first client mount.
- **Path alias**: `~/*` maps to `./app/*`.

### Data model

`CornerNode` (junction points) and `WallSegment` (edges between corners) form a graph. Walls have optional `openings` (doors/windows) and `components` (switches/sensors). `Room` is a detected closed polygon of corners/walls with computed area and centroid.

### Gotchas

- `@types/three` must be in devDependencies for typecheck to pass.
- Client chunk is ~900KB minified. Consider `manualChunks` in Vite config if bundle size matters.
- Walls with `visible: false` still act as room dividers in the detection graph.
