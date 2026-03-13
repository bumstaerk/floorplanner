# Floorplanner

> **Disclaimer:** This project is entirely written with AI — mainly [Claude](https://claude.ai) via [Claude Code](https://github.com/anthropics/claude-code). I'm using it as an experiment with [OpenSpec](https://github.com/auge/openspec), an AI-driven workflow for proposing, specifying, and implementing changes.

## About

Floorplanner is an interactive 3D floorplan editor built with React and Three.js. Load a floorplan image, draw walls on top of it, and switch to a 3D view to see your layout come to life.

**Key technologies:** React Router (framework mode), React Three Fiber, Zustand, Drizzle ORM, TailwindCSS, TypeScript.

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Development

Start the dev server with HMR:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

### Database

Push the schema to a local SQLite database:

```bash
pnpm db:push
```

You can inspect the database with Drizzle Studio:

```bash
pnpm db:studio
```

## Building for Production

```bash
pnpm build
pnpm start
```

## License

This project is for personal/experimental use.
