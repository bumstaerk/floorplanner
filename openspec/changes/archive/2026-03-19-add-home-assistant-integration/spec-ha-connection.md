# Spec Delta: ha-connection

## ADDED Requirements

### Requirement: HA Credential Storage
The system SHALL store the Home Assistant host URL and Long-Lived Access Token server-side in
the SQLite database. The token SHALL never be returned to the client in any API response.

#### Scenario: Save HA credentials
- **WHEN** the user submits a valid host URL and token via the Settings panel
- **THEN** the credentials are persisted in the `ha_config` table
- **AND** the Settings panel shows a "Connected" status badge

#### Scenario: Config status check
- **WHEN** the client loads the Settings panel
- **THEN** `GET /api/ha/config` returns `{ configured: true }` or `{ configured: false }`
- **AND** the token value is never included in the response

#### Scenario: Remove HA credentials
- **WHEN** the user clicks "Disconnect" in the Settings panel
- **THEN** the `ha_config` row is deleted from the database
- **AND** the Settings panel shows a "Not connected" status badge
- **AND** entity pickers across all components show an empty/disabled state

---

### Requirement: HA Entity Proxy
The system SHALL expose a server-side proxy endpoint that fetches the entity list from the
configured Home Assistant instance and returns it to the client as a simplified array.

#### Scenario: Successful entity fetch
- **WHEN** `GET /api/ha/entities` is called and HA is configured and reachable
- **THEN** the server fetches `${host}/api/states` with the stored token
- **AND** returns `HAEntity[]` with `entityId`, `friendlyName`, `domain`, `state`

#### Scenario: HA not configured
- **WHEN** `GET /api/ha/entities` is called and no `ha_config` row exists
- **THEN** the endpoint returns `200` with an empty array `[]`

#### Scenario: HA unreachable
- **WHEN** `GET /api/ha/entities` is called but the HA host cannot be reached
- **THEN** the endpoint returns `502` with `{ error: "Home Assistant unreachable" }`
- **AND** the client Settings panel shows an error state

---

### Requirement: Test Connection
The system SHALL provide a "Test Connection" action in the Settings panel that validates the
current credentials without saving a plan.

#### Scenario: Valid credentials
- **WHEN** the user clicks "Test Connection" with a reachable HA host and valid token
- **THEN** a success message is shown with the number of entities discovered

#### Scenario: Invalid token
- **WHEN** the user clicks "Test Connection" and HA returns 401
- **THEN** an error message "Invalid token" is shown
