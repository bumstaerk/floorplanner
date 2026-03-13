## ADDED Requirements

### Requirement: 3D preview renders all floors stacked vertically
In preview mode, the system SHALL render walls from all floors simultaneously, stacked vertically along the Y axis. Each floor's walls are offset by the cumulative floor-to-floor heights of the floors below it.

#### Scenario: Two-floor building in 3D
- **WHEN** user switches to 3D preview with a ground floor (height 2.8m) and a first floor
- **THEN** ground floor walls render at Y=0 through Y=wall height
- **THEN** first floor walls render starting at Y=2.8m
- **THEN** both floors are visible simultaneously

#### Scenario: Floor height affects stacking
- **WHEN** user changes ground floor's floor-to-floor height from 2.8m to 3.5m
- **THEN** the first floor's walls shift up to start at Y=3.5m in the 3D preview

### Requirement: Floors are centered on top of each other
All floors SHALL be centered on the same XZ origin point so they visually stack aligned. The centering is computed from the combined bounding box of all floors' corner positions.

#### Scenario: Floors with different footprints
- **WHEN** the ground floor has a 10m×12m footprint and the first floor has a 8m×10m footprint
- **THEN** both floors are centered around the same XZ point in the 3D preview

### Requirement: Floor plates render between floors
A thin horizontal slab (floor plate) SHALL render at the base of each floor above ground level, visually separating the floors.

#### Scenario: Floor plate visibility
- **WHEN** a plan has 2 floors
- **THEN** a floor plate slab renders at the Y level where the first floor begins (Y = ground floor height)

### Requirement: Camera encompasses all floors
In 3D preview mode, the camera SHALL auto-position to frame all floors in the view, accounting for the total building height.

#### Scenario: Camera framing multi-story building
- **WHEN** user enters 3D preview with a 3-floor building
- **THEN** the camera is positioned far enough to show all three floors
- **THEN** the orbit target is set to the vertical center of the building

### Requirement: Per-floor room labels in 3D
Room labels (name and area) SHALL render at the correct Y position for their respective floor.

#### Scenario: Room labels on upper floors
- **WHEN** a room exists on the second floor
- **THEN** its label renders at the Y-offset corresponding to the second floor, not at ground level
