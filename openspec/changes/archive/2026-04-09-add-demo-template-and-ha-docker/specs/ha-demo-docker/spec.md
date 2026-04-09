## ADDED Requirements

### Requirement: Home Assistant demo docker-compose
The repository SHALL include a `docker/` directory with a docker-compose configuration for running a demo Home Assistant instance with pre-configured entities.

#### Scenario: Docker compose starts HA
- **WHEN** the user runs `docker-compose up` in the `docker/` directory
- **THEN** a Home Assistant container starts and is accessible at `http://localhost:8123`

#### Scenario: Demo HA includes matching entities
- **WHEN** the demo HA instance is running
- **THEN** it exposes entities with IDs matching the demo template's `haEntityId` bindings (e.g., `light.living_room`, `switch.entry_light`, `binary_sensor.smoke_hallway_ground`)

#### Scenario: Demo HA includes rich entity set
- **WHEN** the demo HA instance is running
- **THEN** it includes additional entity domains beyond the template bindings: climate, cover, and media_player entities for realistic demo scenarios

#### Scenario: Demo HA allows API access
- **WHEN** the floorplanner attempts to connect to the demo HA at `http://localhost:8123`
- **THEN** the HA instance allows API requests (via demo mode or a documented access token)

### Requirement: Demo HA documentation
The repository SHALL include a `docker/README.md` with setup instructions for the demo HA instance.

#### Scenario: README explains prerequisites
- **WHEN** a user reads `docker/README.md`
- **THEN** it lists Docker and docker-compose as prerequisites

#### Scenario: README explains quick start
- **WHEN** a user reads `docker/README.md`
- **THEN** it provides commands to start the demo HA and explains the expected URL and port

#### Scenario: README explains floorplanner connection
- **WHEN** a user reads `docker/README.md`
- **THEN** it explains how to configure the floorplanner's HA settings to connect to the demo instance
