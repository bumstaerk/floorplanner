# demo-template Specification

## Purpose
TBD - created by archiving change add-demo-template-and-ha-docker. Update Purpose after archive.
## Requirements
### Requirement: Demo house template
The system SHALL include a bundled demo house template (`demo-house.fpjson`) that users can import to explore all editor features.

#### Scenario: Template is importable
- **WHEN** the user imports `demo-house.fpjson` via the Import button
- **THEN** a new plan is created containing a complete two-story house with rooms, doors, windows, and components

#### Scenario: Template contains two floors
- **WHEN** the demo template is loaded
- **THEN** it contains a Ground Floor and First Floor with a staircase opening connecting them

#### Scenario: Template includes named rooms
- **WHEN** the demo template is loaded
- **THEN** all rooms have descriptive names (e.g., "Living Room", "Kitchen", "Master Bedroom")

#### Scenario: Template includes doors and windows
- **WHEN** the demo template is loaded
- **THEN** it contains at least one entry door, multiple interior doors, and windows on exterior walls

#### Scenario: Template includes wall and room components
- **WHEN** the demo template is loaded
- **THEN** it contains light switches, outlets, ceiling lights, and sensors distributed throughout the house

#### Scenario: Template components have HA entity bindings
- **WHEN** the demo template is loaded
- **THEN** each component's `haEntityId` is set to match the corresponding entity in the demo Home Assistant configuration

### Requirement: Template accessibility
The system SHALL serve the demo template from a public URL that can be fetched client-side.

#### Scenario: Template is publicly accessible
- **WHEN** a client requests `/templates/demo-house.fpjson`
- **THEN** the server returns the JSON file with the complete demo plan

### Requirement: Template format version
The demo template SHALL include a `formatVersion` field consistent with the current export format.

#### Scenario: Template has valid format version
- **WHEN** the demo template is parsed
- **THEN** it contains `formatVersion: 1` (or the current format version)

