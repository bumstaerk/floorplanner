## ADDED Requirements

### Requirement: Wall Component 2D Rendering
The system SHALL render each wall component as a small colored circle marker on the wall in 2D build mode, positioned at the component's `offset` along the wall center line. Each component type SHALL have a distinct color:
- `light` — yellow/amber
- `sensor` — teal/cyan
- `outlet` — green
- `switch` — orange

Components on invisible walls SHALL NOT be rendered.

#### Scenario: Components displayed on wall in 2D
- **WHEN** a wall has one or more components
- **THEN** each component is rendered as a filled circle at its offset along the wall center line
- **AND** the circle color corresponds to the component's type

#### Scenario: No components on wall
- **WHEN** a wall has zero components
- **THEN** no component markers are rendered for that wall

#### Scenario: Components on invisible wall
- **WHEN** a wall is marked as invisible (`visible: false`)
- **THEN** its components are NOT rendered in 2D

### Requirement: Wall Component 3D Rendering
The system SHALL render each wall component as a small 3D shape on the wall surface in 3D preview mode, positioned at the component's `offset` along the wall direction and `elevation` above the floor. The component SHALL be placed on the wall face corresponding to its `face` property ("left" or "right"). Each component type SHALL use a distinct 3D shape:
- `light` — sphere with emissive material
- `sensor` — octahedron
- `outlet` — flat box (rectangular plate)
- `switch` — flat box, taller than wide

Components on invisible walls SHALL NOT be rendered in 3D.

#### Scenario: Components displayed on wall in 3D
- **WHEN** a wall has one or more components
- **THEN** each component is rendered as a 3D shape at the correct position on the wall face
- **AND** the shape and color correspond to the component's type
- **AND** the component is placed at the correct elevation above the floor

#### Scenario: Component face placement in 3D
- **WHEN** a component has `face: "left"`
- **THEN** the 3D shape is placed on the left face of the wall (offset by half the wall thickness along the wall normal)
- **WHEN** a component has `face: "right"`
- **THEN** the 3D shape is placed on the right face of the wall (offset by negative half the wall thickness along the wall normal)

#### Scenario: Components on invisible wall in 3D
- **WHEN** a wall is marked as invisible (`visible: false`)
- **THEN** its components are NOT rendered in 3D

### Requirement: Wall Component Property Editing
The system SHALL allow editing wall component offset, elevation, and face via the properties panel using `NumberInput` fields and a face dropdown, matching the existing opening editing pattern. The offset SHALL be constrained between 0 and the wall length. The elevation SHALL be constrained between 0 and the wall height.

#### Scenario: Edit wall component offset
- **WHEN** a wall is selected and a component is displayed in the properties panel
- **THEN** the user can change the component's offset via a NumberInput field
- **AND** the offset is constrained between 0 and the wall length

#### Scenario: Edit wall component elevation
- **WHEN** a wall is selected and a component is displayed in the properties panel
- **THEN** the user can change the component's elevation via a NumberInput field
- **AND** the elevation is constrained between 0 and the wall height

#### Scenario: Edit wall component face
- **WHEN** a wall is selected and a component is displayed in the properties panel
- **THEN** the user can change the component's face via a dropdown selecting "left" or "right"

### Requirement: Component Theme Colors
The system SHALL provide theme color tokens for each of the four component types, supporting both light and dark themes. The colors SHALL be accessible through the existing `useThemeColors()` hook and `ThemeColors` interface.

#### Scenario: Theme colors available for component types
- **WHEN** a scene component needs a color for a wall or room component type
- **THEN** it can access a dedicated color token from `useThemeColors()` for each of `light`, `sensor`, `outlet`, and `switch`
- **AND** the colors differ between light and dark themes
