## ADDED Requirements

### Requirement: Room Component Data Model
The system SHALL support a `RoomComponent` type with fields: `id` (string), `type` ("light" | "sensor"), `label` (string), `x` (number, meters), `y` (number, meters), and optional `meta` (Record). The `Room` interface SHALL include a `components: RoomComponent[]` array. Only `light` and `sensor` types SHALL be supported as room ceiling components.

#### Scenario: Room has components array
- **WHEN** a room is detected or loaded
- **THEN** it has a `components` array (possibly empty) of `RoomComponent` objects

#### Scenario: Room component has position in floorplan coordinates
- **WHEN** a room component exists
- **THEN** it has `x` and `y` fields representing its position in floorplan meters (absolute coordinates, not relative to room centroid)

### Requirement: Room Component Persistence
The system SHALL persist room components in a `room_components` database table keyed by the room's polygon hash (sorted corner IDs joined by comma). Room components SHALL survive room re-detection as long as the room's corner set remains unchanged. When the room's corner set changes (room is reshaped or deleted), its components SHALL be lost.

#### Scenario: Room components persist across save and load
- **WHEN** a plan with room components is saved and reloaded
- **THEN** the room components are restored to the correct rooms by matching the polygon hash

#### Scenario: Room components survive re-detection
- **WHEN** walls or corners are modified but a room's corner set remains the same
- **THEN** the room's components are preserved through room re-detection

#### Scenario: Room components lost when room shape changes
- **WHEN** a wall or corner modification changes a room's corner set
- **THEN** the components belonging to the previous room shape are lost

### Requirement: Room Component Store Actions
The system SHALL provide store actions to add, remove, and update room components: `addRoomComponent(roomId, component)`, `removeRoomComponent(roomId, componentId)`, and `updateRoomComponent(roomId, componentId, patch)`. Adding a component SHALL place it at the room's centroid by default.

#### Scenario: Add a room component
- **WHEN** `addRoomComponent` is called with a room ID and component data
- **THEN** a new component with a generated UUID is added to that room's components array

#### Scenario: Remove a room component
- **WHEN** `removeRoomComponent` is called with a room ID and component ID
- **THEN** the component is removed from that room's components array

#### Scenario: Update a room component position
- **WHEN** `updateRoomComponent` is called with a partial patch containing `x` and/or `y`
- **THEN** the component's position is updated accordingly

### Requirement: Room Component 2D Rendering
The system SHALL render each room component as a small colored circle at its `(x, y)` position in the 2D build mode. The color SHALL match the component type: `light` uses the light color token, `sensor` uses the sensor color token.

#### Scenario: Room components displayed in 2D
- **WHEN** a room has one or more components
- **THEN** each component is rendered as a filled circle at its `(x, y)` position in the 2D scene
- **AND** the circle color corresponds to the component's type

#### Scenario: Room with no components
- **WHEN** a room has zero components
- **THEN** no component markers are rendered for that room

### Requirement: Room Component 3D Rendering
The system SHALL render each room component as a 3D shape mounted on the ceiling surface in 3D preview mode. The ceiling height SHALL be the wall height for that floor. The component's `(x, y)` floorplan position SHALL map to `(x, z)` in 3D world space at Y equal to the ceiling height. The shape SHALL correspond to the component type: sphere with emissive material for `light`, octahedron for `sensor`. Components SHALL face downward (hanging from ceiling).

#### Scenario: Room components displayed on ceiling in 3D
- **WHEN** a room has one or more components
- **THEN** each component is rendered as a 3D shape at the ceiling height at the correct `(x, z)` position
- **AND** the shape and color correspond to the component's type

#### Scenario: Light component emits glow in 3D
- **WHEN** a room component of type `light` is rendered in 3D
- **THEN** it uses an emissive material to visually suggest illumination

### Requirement: Room Component Properties Panel
The system SHALL display a "Ceiling Components" section in the room properties panel when a room is selected. The section SHALL include buttons to add a light or sensor component (placed at the room centroid by default). Each component SHALL display its label, type icon, X and Y position as editable `NumberInput` fields, and a remove button.

#### Scenario: Add ceiling light via properties panel
- **WHEN** a room is selected and the user clicks "Add Light" in the ceiling components section
- **THEN** a new light component is added at the room's centroid
- **AND** it appears in the component list with editable X/Y inputs

#### Scenario: Add ceiling sensor via properties panel
- **WHEN** a room is selected and the user clicks "Add Sensor" in the ceiling components section
- **THEN** a new sensor component is added at the room's centroid
- **AND** it appears in the component list with editable X/Y inputs

#### Scenario: Edit room component position
- **WHEN** a room component's X or Y NumberInput is changed
- **THEN** the component's position is updated in the store and its rendering moves accordingly

#### Scenario: Remove room component
- **WHEN** the user clicks the remove button on a room component
- **THEN** the component is removed from the room
