## ADDED Requirements

### Requirement: Plan SHALL have at least one floor
Every plan MUST contain at least one floor. When a new plan is created, a default floor named "Ground Floor" with level 0 SHALL be created automatically.

#### Scenario: New plan creation
- **WHEN** user creates a new plan
- **THEN** the plan contains exactly one floor named "Ground Floor" at level 0

#### Scenario: Cannot delete last floor
- **WHEN** user attempts to delete the only remaining floor in a plan
- **THEN** the system SHALL prevent deletion and display an error message

### Requirement: User can add floors to a plan
The system SHALL allow users to add new floors to an existing plan. Each floor has a name, a level integer (for ordering and 3D positioning), and a floor-to-floor height in meters (default 2.8m).

#### Scenario: Add a floor
- **WHEN** user clicks "Add Floor" in the floor management UI
- **THEN** a new floor is created with an auto-generated name (e.g., "Floor 1"), level = max existing level + 1, and default floor height of 2.8m
- **THEN** the new floor becomes the active floor

#### Scenario: Floor has configurable properties
- **WHEN** user edits a floor's name or floor height
- **THEN** the changes are reflected in the floor list and 3D preview

### Requirement: User can delete floors
The system SHALL allow users to delete any floor that is not the last remaining floor. Deleting a floor removes all its corners, walls, rooms, floorplan image, and staircase openings.

#### Scenario: Delete a floor with geometry
- **WHEN** user deletes a floor that contains walls and corners
- **THEN** all corners, walls, rooms, the floorplan image, and staircase openings on that floor are removed
- **THEN** the active floor switches to the nearest remaining floor

### Requirement: User can switch between floors in 2D mode
In build mode, the system SHALL display a floor selector that shows all floors ordered by level. Only the active floor's geometry (corners, walls, rooms, floorplan image) is editable and fully rendered.

#### Scenario: Switch active floor
- **WHEN** user selects a different floor in the floor selector
- **THEN** the 2D scene updates to show the selected floor's corners, walls, rooms, and floorplan image
- **THEN** any in-progress drawing operation is cancelled
- **THEN** all selections are cleared

#### Scenario: Floor selector ordering
- **WHEN** floor selector is displayed
- **THEN** floors are listed in descending order by level (highest floor at top)

### Requirement: Each floor has independent geometry
Corners, walls, and rooms on one floor SHALL be independent of other floors. Drawing on one floor does not affect another floor's geometry.

#### Scenario: Draw wall on active floor
- **WHEN** user draws a wall on Floor 1
- **THEN** the wall and its corners are associated with Floor 1 only
- **THEN** Floor 0's geometry remains unchanged

### Requirement: Each floor can have its own floorplan image
Each floor SHALL independently support uploading a background floorplan image for tracing walls over.

#### Scenario: Upload image for specific floor
- **WHEN** user uploads a floorplan image while Floor 1 is active
- **THEN** the image is associated with Floor 1
- **THEN** Floor 0's floorplan image (if any) remains unchanged

### Requirement: Floor data persists with the plan
When a plan is saved, all floors and their associated data (corners, walls, floorplan images, staircase openings) SHALL be persisted. When loaded, the full multi-floor structure is restored.

#### Scenario: Save and reload multi-floor plan
- **WHEN** user saves a plan with 3 floors, each containing walls
- **THEN** reloading the plan restores all 3 floors with their geometry intact

#### Scenario: Existing single-floor plans load correctly
- **WHEN** a plan saved before multi-floor support is loaded
- **THEN** it appears as a single "Ground Floor" at level 0 with all original geometry
