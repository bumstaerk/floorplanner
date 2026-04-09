# Change: Add demo house template and Home Assistant docker-compose

## Why

New users currently start with an empty canvas and must manually draw walls to see anything. A pre-built demo template of a realistic mid-size house provides an instant "try it out" experience showcasing multi-floor support, doors, windows, and components (lights, switches, sensors). Pairing this with a ready-to-run Home Assistant docker-compose allows users to test the HA integration without configuring their own instance.

## What Changes

- Add a **demo-house.fpjson** template file in `public/templates/` containing:
  - Two floors (Ground Floor + First Floor)
  - ~8-10 rooms across both floors (living room, kitchen, bedrooms, bathrooms, hallway, etc.)
  - Multiple doors (entry door, interior doors)
  - Multiple windows (various sizes)
  - Wall components (light switches, outlets, sensors)
  - Room/ceiling components (ceiling lights, smoke detectors)
  - A staircase opening connecting the floors
  - All components pre-bound to HA entity IDs matching the demo HA instance

- Add a **docker/** directory with:
  - `docker-compose.yml` — Home Assistant container in demo mode with pre-seeded entities
  - `configuration.yaml` — HA config with demo entities matching the template components
  - `README.md` — Quick-start instructions for running the demo stack

- Add a **Toolbar button** to load the demo template directly (or document the import workflow)

- Document the **template maintenance process** so future schema changes prompt a template update

## Impact

- New capabilities:
  - `demo-template` — bundled demo house template
  - `ha-demo-docker` — docker-compose for HA demo instance

- Affected files:
  - `public/templates/demo-house.fpjson` (new)
  - `docker/docker-compose.yml` (new)
  - `docker/homeassistant/configuration.yaml` (new)
  - `docker/README.md` (new)
  - `app/components/Toolbar.tsx` (optional: add "Load Demo" button)
  - `README.md` (update with demo instructions)
