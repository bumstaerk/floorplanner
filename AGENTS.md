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

# AGENTS.md

Guidance for AI coding agents operating in this repository.

## Project overview

Interactive 3D floorplan editor: load an image, draw walls over it in 2D, preview in 3D. Built with React Router v7 (framework mode, SSR), React Three Fiber + Drei, Zustand, Drizzle ORM + SQLite, Tailwind CSS v4, TypeScript (strict).

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

No test framework, linter, or formatter is configured. Use `pnpm typecheck` as the primary correctness check after changes.

## Architecture

### Directory layout

```
app/
  components/     # UI overlays (Toolbar, PropertiesPanel, StatusBar)
  db/             # Drizzle ORM layer (schema.ts, queries.ts, index.ts)
  hooks/          # Custom React hooks (useThemeColors)
  routes/         # React Router route modules (pages + API routes)
  scene/          # R3F scene components (2D build + 3D preview)
  store/          # Zustand stores, types, algorithms (roomDetection)
  root.tsx        # App shell, Layout, ErrorBoundary
  routes.ts       # Manual route config
  app.css         # Tailwind entry point
data/             # SQLite database files (gitignored)
openspec/         # AI-driven change management specs
```

### Key patterns

- **Client-only R3F**: Never SSR R3F components. Never use R3F's `useLoader` (unmounts Canvas on suspend). Use imperative Three.js loaders in `useEffect`.
- **Coordinate system**: 2D floorplan `(x, y)` in meters maps to 3D world `(x, 0, z)` with Y-axis up.
- **Multi-floor**: All geometry (corners, walls, rooms, staircase openings, floorplan images) is scoped to a `floorId`. The store tracks `currentFloorId`.
- **Room detection**: DCEL/half-edge algorithm in `app/store/roomDetection.ts`. Auto-triggers on wall/corner changes via Zustand subscription.
- **Wall geometry**: `app/scene/wallGeometryUtils.ts` computes mitered corner outlines used by both Wall2D and Wall3D.
- **Snapping**: Grid snap, corner snap, angle snap. Helpers: `findSnapCorner()`, `snapToGrid()`.
- **History**: Snapshots of `(corners, walls, staircaseOpenings)` state, max 100 entries. Call `pushHistory()` before mutations.
- **Plan hydration**: `home.tsx` loader fetches the most recent plan server-side; `useHydrateStore()` pushes it into Zustand on first client mount.
- **Path alias**: `~/*` maps to `./app/*` (configured in tsconfig).
- **No barrel exports**: Every import references the specific file directly.

### Data model

`CornerNode` (junction points) and `WallSegment` (edges between corners) form a graph. Walls have optional `openings` (doors/windows) and `components` (switches/sensors). `StaircaseOpening` is a rectangular area placed on a floor. `Room` is a detected closed polygon with computed area and centroid. All defined in `app/store/types.ts`.

## Code style

### Formatting

- **Semicolons**: Always.
- **Quotes**: Double quotes (`"`).
- **Trailing commas**: Always (objects, arrays, imports, parameters).
- **Indentation**: Mixed — 4 spaces in `useFloorplanStore.ts`, `useThemeStore.ts`, and `db/` files; 2 spaces in `routes/`, `scene/`, `components/`, `store/types.ts`, `root.tsx`. No formatter enforces this. Match the file you are editing.
- **Line length**: No hard limit. Tailwind class strings may be long.
- **Section banners**: `// ─── Section Name ────────` (box drawing `─` character) to organize large files.

### Imports

- Generally external packages first, then internal modules (not strictly enforced, no formatter).
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax: true`).
- Use `~/*` alias for cross-layer imports (e.g., route importing from db). Use relative paths (`../`) for same-layer or nearby imports.
- Use `import * as` for schema modules and Three.js (`import * as THREE from "three"`).

### TypeScript

- **Strict mode is on.** All code must pass `pnpm typecheck`.
- Use `interface` for object shapes. Use `type` for unions and simple aliases.
- Name types/interfaces in `PascalCase` without prefixes (no `I` or `T` prefix).
- Add explicit return types on standalone helper/utility functions.
- Use `Partial<Pick<T, ...>>` for update patches, `Omit<T, "id">` for creation payloads.
- Prefer `T | null` over `T | undefined` for optional return values.
- Document exported interfaces and non-trivial functions with JSDoc (`/** ... */`).

### Components

- Use named `function` declarations (not arrow functions, not `React.FC`).
- Route page components: `export default function ComponentName(...)`.
- Everything else: named exports (`export function ComponentName(...)`).
- Props: named `interface` (e.g., `Wall2DProps`) for documented props; inline `{ prop }: { prop: Type }` for trivial single-prop components.
- Sub-components can be co-located in the same file as non-exported functions.
- Side-effect-only components return `null`.

### Naming conventions

| What | Convention | Examples |
|------|-----------|----------|
| Files (components/scenes) | `PascalCase.tsx` | `Wall2D.tsx`, `BuildScene.tsx` |
| Files (stores/hooks) | `camelCase.ts` with `use` prefix | `useFloorplanStore.ts` |
| Files (utilities) | `camelCase.ts` | `wallGeometryUtils.ts`, `roomDetection.ts` |
| Files (routes) | React Router flat-file convention | `api.plans.$id.ts` |
| Variables/functions | `camelCase` | `wallId`, `findSnapCorner` |
| Types/interfaces | `PascalCase` | `WallSegment`, `FloorplanState` |
| Module constants | `UPPER_SNAKE_CASE` | `DEFAULT_WALL_HEIGHT` |
| DB columns | `snake_case` | `default_wall_thickness`, `created_at` |
| Zustand stores | `use` + `PascalCase` + `Store` | `useFloorplanStore` |
| Boolean state (store) | Natural name, no prefix | `saving`, `loading`, `visible` |
| Boolean (local derived) | `is` prefix | `isSelected`, `isHovered` |

### State management (Zustand)

- Two stores: `useFloorplanStore` (all editor state) and `useThemeStore` (light/dark theme with localStorage persistence).
- One selector per `useFloorplanStore(...)` call. Do not destructure multiple fields from a single call.
- Use `useShallow` for selectors returning arrays or objects.
- Use `set((s) => ({ ...s, field: newValue }))` for state updates.
- Access store outside React with `useFloorplanStore.getState()`.
- Deep-clone via `JSON.parse(JSON.stringify(...))` for history snapshots.

### Error handling

- **API routes**: Wrap complex handlers (save) in `try/catch`. Log with `console.error`. Return `Response.json({ error: "..." }, { status: 5xx })`.
- **Simple loaders**: Return `404` for not-found resources. No try/catch needed for simple DB reads.
- **Client async actions**: `try/catch` with `console.error`. Reset loading flags in `catch`/`finally`.
- **localStorage access**: Silent `catch {}` for graceful degradation.
- **Root ErrorBoundary**: In `app/root.tsx`. Checks `isRouteErrorResponse` for status codes.

### API routes

- Use React Router v7's `loader` (GET) and `action` (POST/DELETE) exports.
- Import generated types: `import type { Route } from "./+types/routeName"`.
- Return `Response.json(...)` with appropriate status codes.
- Check HTTP method explicitly with `405` response for unsupported methods.
- Use Drizzle query builder API (not relational API) with `.get()` for single rows, `.all()` for arrays.
- When working on routes, loaders, actions, or React Router conventions, load the `react-router-framework-mode` skill for detailed reference.

### Database

- All primary keys are text UUIDs (generated via `uuid` package).
- Timestamps are epoch milliseconds stored as `integer`.
- Booleans are stored as `integer` (0/1). Convert manually: `visible: row.visible !== 0`.
- All foreign keys use `onDelete: "cascade"`.
- No validation library (no Zod). Request bodies are trusted; use `??` for fallback defaults.

## Gotchas

- `@types/three` must be in `devDependencies` for typecheck to pass.
- Walls with `visible: false` still participate in room detection.
- The save endpoint uses delete-then-reinsert (not upsert). No transaction wrapping exists.
- Route types are generated by `react-router typegen` (runs as part of `pnpm typecheck`). If you add or rename routes, run `pnpm typecheck` to regenerate `.react-router/types/`.
- SQLite foreign keys are explicitly enabled in `app/db/index.ts` (off by default in SQLite).
