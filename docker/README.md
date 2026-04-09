# Home Assistant Demo for Floorplanner

This directory contains a ready-to-run Home Assistant setup for testing the floorplanner's HA integration.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

## Quick Start

1. **Start Home Assistant:**

   ```bash
   cd docker
   docker-compose up -d
   ```

2. **Wait for HA to initialize** (~30 seconds on first run):

   ```bash
   docker-compose logs -f homeassistant
   # Wait until you see "Home Assistant initialized"
   # Press Ctrl+C to exit logs
   ```

3. **Access Home Assistant:**

   Open http://localhost:8123 in your browser.

   On first launch, HA will ask you to create an account. Create any account (e.g., `demo` / `demo1234`).

4. **Generate a Long-Lived Access Token:**

   - Click your profile icon (bottom left) → **Security** tab
   - Scroll to **Long-Lived Access Tokens**
   - Click **Create Token**, name it `floorplanner`, and copy the token

5. **Start the Floorplanner** (in a separate terminal):

   ```bash
   cd ..  # back to project root
   pnpm dev
   ```

6. **Connect Floorplanner to Home Assistant:**

   - Open http://localhost:5173
   - In the right panel, expand **Home Assistant**
   - Enter:
     - **Host URL:** `http://localhost:8123`
     - **Long-Lived Access Token:** (paste the token from step 4)
   - Click **Save & Connect**

7. **Load the Demo Template:**

   - Click the **Import** button in the toolbar
   - Navigate to `public/templates/demo-house.fpjson`
   - Or download from http://localhost:5173/templates/demo-house.fpjson and import it

   The demo house has all components pre-bound to HA entities.

## What's Included

The demo HA instance includes:

### Lights
- `light.living_room` - Living Room (dimmable)
- `light.kitchen` - Kitchen (dimmable)
- `light.dining_room` - Dining Room
- `light.entry` - Entry
- `light.hallway_ground` - Ground Floor Hallway
- `light.hallway_first` - First Floor Hallway
- `light.bathroom_ground` - Ground Floor Bathroom
- `light.master_bedroom` - Master Bedroom (dimmable)
- `light.master_bathroom` - Master Bathroom
- `light.bedroom_2` - Bedroom 2
- `light.bedroom_3` - Bedroom 3
- `light.bathroom_first` - First Floor Bathroom
- `light.utility` - Utility Room

### Switches
- `switch.entry_light` - Entry Light Switch
- `switch.kitchen_outlet` - Kitchen Outlet
- `switch.utility_outlet` - Utility Outlet

### Binary Sensors
- `binary_sensor.entry_motion` - Entry Motion Sensor
- `binary_sensor.hallway_motion` - Hallway Motion Sensor
- `binary_sensor.smoke_hallway_ground` - Ground Floor Smoke Detector
- `binary_sensor.smoke_hallway_first` - First Floor Smoke Detector

### Climate
- `climate.living_room` - Living Room Thermostat
- `climate.master_bedroom` - Master Bedroom Thermostat

### Covers
- `cover.living_room_blinds` - Living Room Blinds
- `cover.master_bedroom_blinds` - Master Bedroom Blinds

### Media Player
- `media_player.bedroom` (from demo integration)

## Controlling Entities

You can control demo entities in several ways:

1. **Home Assistant UI** - http://localhost:8123
2. **Home Assistant Developer Tools** → Services
3. **REST API** - e.g., `curl -X POST -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/services/light/turn_on -d '{"entity_id": "light.living_room"}'`

The entities are backed by `input_boolean` and `input_number` helpers, so state changes persist.

## Stopping the Demo

```bash
docker-compose down
```

To also remove the HA data (start fresh):

```bash
docker-compose down -v
rm -rf homeassistant/.storage homeassistant/home-assistant_v2.db
```

## Troubleshooting

### "Connection refused" when connecting from Floorplanner

Make sure:
- HA is running: `docker-compose ps` should show `floorplanner-ha-demo` as `Up`
- You're using `http://localhost:8123` (not `https`)
- The token is correct (no extra spaces)

### CORS errors in browser console

The configuration includes CORS headers for `localhost:5173` and `localhost:3000`. If you're running the floorplanner on a different port, add it to `http.cors_allowed_origins` in `homeassistant/configuration.yaml` and restart HA:

```bash
docker-compose restart homeassistant
```

### Entities not appearing

Wait 30-60 seconds after HA starts for all template entities to initialize. Check http://localhost:8123/developer-tools/state to see all entities.
