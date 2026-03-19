# Spec Delta: component-model

## MODIFIED Requirements

### Requirement: WallComponent Entity Binding
A `WallComponent` (light, sensor, outlet, switch) MAY have an optional `haEntityId: string | null`
field that binds it to a Home Assistant entity. The binding SHALL be persisted with the plan
and round-tripped correctly through save and load.

#### Scenario: Bind entity to wall component
- **WHEN** the user opens a WallComponent editor in the PropertiesPanel
- **AND** selects an entity from the HAEntityPicker
- **THEN** `haEntityId` is set on the component in the Zustand store
- **AND** the selected entity's friendly name is shown in the picker

#### Scenario: Clear entity binding
- **WHEN** the user clicks the clear button in the HAEntityPicker
- **THEN** `haEntityId` is set to `null` on the component

#### Scenario: Binding persists across save/load
- **WHEN** a plan with bound components is saved and reloaded
- **THEN** every component's `haEntityId` is restored correctly

---

### Requirement: RoomComponent Entity Binding
A `RoomComponent` (ceiling light, ceiling sensor) MAY have an optional `haEntityId: string | null`
field following the same rules as WallComponent entity binding.

#### Scenario: Bind entity to room component
- **WHEN** the user opens a RoomComponent editor in the PropertiesPanel
- **AND** selects an entity from the HAEntityPicker
- **THEN** `haEntityId` is set on the room component in the Zustand store

---

## ADDED Requirements

### Requirement: HAEntity Picker Component
The system SHALL provide a reusable `HAEntityPicker` UI component that:
- Fetches the entity list from `GET /api/ha/entities` once on mount
- Renders a searchable text input that filters by `entityId` and `friendlyName`
- Displays the currently bound entity (ID + friendly name) when a value is set
- Provides a clear/unbind button
- Shows a disabled/empty state when HA is not configured

#### Scenario: Search entities
- **WHEN** the user types in the entity picker input
- **THEN** the dropdown filters to entities matching the query in either `entityId` or `friendlyName`

#### Scenario: HA not configured
- **WHEN** the entity picker mounts and `api/ha/entities` returns an empty array
- **THEN** the picker shows a "Home Assistant not connected" placeholder
- **AND** the input is disabled
