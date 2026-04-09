# Tasks: Add Demo Template and HA Docker

## 1. Create demo house template

- [x] 1.1 Create `public/templates/` directory
- [x] 1.2 Design and draw the two-story house layout in the editor:
  - Ground floor: entryway, living room, kitchen, dining, bathroom, utility
  - First floor: master bedroom + en-suite, 2 bedrooms, bathroom, hallway
  - Staircase opening connecting floors
- [x] 1.3 Add doors: front entry door, ~6 interior doors
- [x] 1.4 Add windows: ~12 windows of varying sizes
- [x] 1.5 Add wall components with HA entity IDs:
  - Light switches: `switch.entry_light`, `switch.living_room_light`, etc.
  - Outlets in kitchen, bedrooms, living room
- [x] 1.6 Add room/ceiling components with HA entity IDs:
  - Ceiling lights: `light.living_room`, `light.kitchen`, `light.master_bedroom`, etc.
  - Smoke detectors: `binary_sensor.smoke_hallway_ground`, `binary_sensor.smoke_hallway_first`
  - Motion sensors: `binary_sensor.entry_motion`
- [x] 1.7 Name all rooms appropriately (Living Room, Kitchen, Master Bedroom, etc.)
- [x] 1.8 Export the plan to `public/templates/demo-house.fpjson`

## 2. Create Home Assistant docker-compose

- [x] 2.1 Create `docker/` directory structure
- [x] 2.2 Create `docker/docker-compose.yml`:
  - Home Assistant container with pinned version
  - Volume mount for configuration
  - Port 8123 exposed
- [x] 2.3 Create `docker/homeassistant/configuration.yaml`:
  - Enable demo integration for rich sample data
  - Define template lights matching the template (light.living_room, light.kitchen, etc.)
  - Define template switches (switch.entry_light, etc.)
  - Define template binary sensors (smoke, motion)
  - Define climate entities (climate.living_room, climate.master_bedroom)
  - Define cover entities (cover.living_room_blinds, etc.)
  - Define media_player entities (media_player.living_room_tv)
  - Configure CORS for localhost:5173

## 3. Documentation

- [x] 3.1 Create `docker/README.md` with:
  - Prerequisites (Docker, docker-compose)
  - Quick start commands
  - Expected HA URL and port
  - How to generate/find access token (or explain demo mode)
  - How to connect the floorplanner to the demo HA
- [x] 3.2 Update root `README.md` with:
  - "Try the Demo" section
  - Links to docker/README.md and template import instructions
- [x] 3.3 Add template maintenance note to CLAUDE.md or a CONTRIBUTING.md

## 4. Optional: Add "Load Demo" toolbar button

- [x] 4.1 Add button to Toolbar.tsx that fetches `/templates/demo-house.fpjson`
- [x] 4.2 Post to `/api/plans/import` to create a new plan from the template
- [x] 4.3 Load the imported plan into the editor
