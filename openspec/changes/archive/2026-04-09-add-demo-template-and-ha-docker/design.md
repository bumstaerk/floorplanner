# Design: Demo Template and Home Assistant Docker

## Context

The floorplan editor supports multi-floor plans with walls, doors, windows, wall components (switches, outlets), room components (ceiling lights, sensors), and Home Assistant integration. New users have no example content to explore. The HA integration requires a running HA instance with valid credentials, making it hard to demo.

## Goals / Non-Goals

**Goals:**
- Provide a realistic two-story house template that showcases all editor features
- Include a docker-compose that spins up HA with demo entities matching the template
- Make it trivial to connect the template to the demo HA instance
- Establish a process for keeping the template in sync with schema changes

**Non-Goals:**
- Perfect architectural accuracy (this is a demo, not a blueprint)
- Production-ready HA configuration (demo mode only)
- Automated migration of the template when schema changes (manual update is fine)

## Decisions

### 1. Template Format — `.fpjson` file in `public/templates/`

**Decision:** Ship the demo template as `public/templates/demo-house.fpjson`, importable via the existing Import button or a new "Load Demo" toolbar action.

**Rationale:** The `.fpjson` format is already supported for import/export. Storing in `public/` makes it accessible via a simple fetch without adding API routes. Users can also download and inspect the file to learn the format.

**Alternatives considered:**
- *Seed in database on startup* — More "magical" but harder to maintain; rejected because it conflates app initialization with demo data.
- *External download* — Adds network dependency; rejected for offline demo capability.

### 2. Template Content — Realistic two-story house

**Decision:** Design a ~150-200 m² house with:

**Ground Floor:**
- Entryway / hallway
- Living room (large, open)
- Kitchen
- Dining area
- Bathroom / WC
- Utility room

**First Floor:**
- Master bedroom with en-suite bathroom
- 2 additional bedrooms
- Family bathroom
- Hallway / landing

**Openings:**
- Front door (entry)
- ~5-6 interior doors
- ~10-12 windows (various sizes)

**Components:**
- Light switches near each door
- Outlets in key locations
- Ceiling lights in each room
- Smoke detectors in hallways
- Motion sensor in entry

**Decision:** All components include `haEntityId` bindings that match the demo HA configuration (e.g., `light.living_room`, `switch.entry_light`, `sensor.hallway_motion`).

### 3. HA Docker Setup — Demo entities via template configuration

**Decision:** Use Home Assistant's `demo` integration plus explicit `input_boolean`, `light`, `switch`, and `sensor` template entities to match the floorplan components exactly.

**Structure:**
```
docker/
├── docker-compose.yml
├── homeassistant/
│   └── configuration.yaml
└── README.md
```

**Rationale:** HA's demo integration provides sample entities, but we need specific entity IDs to match our template. We'll combine the demo integration for realism with explicit template entities for precise control.

**Key entities (example):**
```yaml
# Lights
light.living_room
light.kitchen
light.master_bedroom
light.bedroom_2
light.bedroom_3
light.entry
light.hallway_ground
light.hallway_first
light.bathroom_ground
light.bathroom_master
light.bathroom_first

# Switches
switch.entry_light
switch.utility_outlet

# Sensors
sensor.hallway_motion
sensor.entry_motion
binary_sensor.smoke_hallway_ground
binary_sensor.smoke_hallway_first

# Climate (bonus rich demo)
climate.living_room
climate.master_bedroom

# Cover (bonus)
cover.living_room_blinds
cover.master_bedroom_blinds

# Media player (bonus)
media_player.living_room_tv
```

### 4. Demo Connection — Pre-configured credentials

**Decision:** The README will instruct users to:
1. `cd docker && docker-compose up -d`
2. Wait for HA to start at `http://localhost:8123`
3. In the floorplanner, configure HA with:
   - Host: `http://localhost:8123`
   - Token: (provided in README, or use HA's demo mode token)

**Note:** HA demo mode doesn't require authentication for API access, simplifying the setup. We'll configure CORS to allow the floorplanner origin.

### 5. Template Maintenance — Manual update on schema changes

**Decision:** Document in `CONTRIBUTING.md` or `README.md` that when the `.fpjson` schema changes (new fields, renamed fields), the `demo-house.fpjson` must be re-exported from a working plan.

**Process:**
1. Load the existing template via Import
2. Make any adjustments needed for the new schema
3. Export to `public/templates/demo-house.fpjson`
4. Commit the updated file

**Rationale:** Schema changes are infrequent. A fully automated migration would add complexity for little benefit.

## Risks / Trade-offs

- **Template file size**: The `.fpjson` will be ~50-100 KB (no images). Acceptable for a demo asset.
- **Entity ID drift**: If the template's entity IDs diverge from the docker config, bindings won't work. Mitigation: keep both files in the same PR and review together.
- **HA version compatibility**: The docker-compose pins a specific HA version to avoid breaking changes. Users can update at their own risk.

## Open Questions

- Should the "Load Demo" button replace Import or be separate? → Separate button for discoverability, but initially just document the Import workflow to keep scope small.
- Should the template include room names? → Yes, pre-named rooms improve the demo experience.
