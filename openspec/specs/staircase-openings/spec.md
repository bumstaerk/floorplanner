## ADDED Requirements

### Requirement: User can place staircase openings on a floor
The system SHALL provide a tool to place rectangular staircase openings on any floor. A staircase opening has a position, width, depth, and rotation. It represents the area where stairs connect to the floor above or below.

#### Scenario: Place a staircase opening
- **WHEN** user selects the staircase tool and clicks on the 2D canvas
- **THEN** a staircase opening is created at the clicked position on the active floor
- **THEN** the staircase opening has default dimensions (1.0m × 2.5m)

#### Scenario: Staircase opening properties
- **WHEN** user selects an existing staircase opening
- **THEN** the properties panel shows width, depth, rotation, and position fields
- **THEN** user can edit these values

### Requirement: Staircase openings render in 2D as labeled rectangles
In build mode, staircase openings SHALL render as dashed-outline rectangles with a stair direction indicator (arrow or zigzag line) and the label "Stairs".

#### Scenario: 2D staircase rendering
- **WHEN** a floor has a staircase opening
- **THEN** a dashed rectangle renders at the staircase's position with its width and depth
- **THEN** the rectangle displays a "Stairs" label at its center

### Requirement: Staircase openings render in 3D as cutouts with placeholder geometry
In preview mode, staircase openings SHALL render as rectangular holes in the floor plate and a simple placeholder mesh (e.g., a sloped plane or step-like geometry) to indicate stairs.

#### Scenario: 3D staircase on upper floor
- **WHEN** a staircase opening exists on the first floor
- **THEN** the floor plate at the first floor level has a rectangular cutout at the staircase's position
- **THEN** a simple stair placeholder mesh connects the ground floor to the first floor at that location

### Requirement: Staircase openings are floor-scoped
Each staircase opening belongs to exactly one floor. Deleting a floor removes its staircase openings.

#### Scenario: Staircase on deleted floor
- **WHEN** user deletes a floor that has a staircase opening
- **THEN** the staircase opening is also removed

### Requirement: Staircase openings can be moved and deleted
Users SHALL be able to select, drag to reposition, and delete staircase openings.

#### Scenario: Move staircase opening
- **WHEN** user drags a staircase opening to a new position
- **THEN** the staircase opening's position updates to the new location

#### Scenario: Delete staircase opening
- **WHEN** user selects a staircase opening and presses Delete
- **THEN** the staircase opening is removed from the floor

### Requirement: Staircase openings persist with the plan
Staircase openings SHALL be saved and loaded as part of the plan data.

#### Scenario: Save and reload staircase openings
- **WHEN** user saves a plan with staircase openings on multiple floors
- **THEN** reloading the plan restores all staircase openings with their positions and dimensions
