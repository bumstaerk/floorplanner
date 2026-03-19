# Spec Delta: ha-connection (Phase 2 modifications)

## MODIFIED Requirements

### Requirement: HA Settings Panel — Connection Status
The HA Settings panel SHALL display a live WebSocket connection status badge that reflects
the current state of the browser's connection to the `/api/ha/ws` endpoint. This supersedes
the static "configured / not configured" indicator from Phase 1.

#### Scenario: Bridge connected and receiving state
- **WHEN** the browser WebSocket is open and a snapshot has been received
- **THEN** the Settings panel shows a green "Connected" badge
- **AND** displays the number of known entities (e.g. "142 entities")

#### Scenario: Bridge reconnecting
- **WHEN** the HA WebSocket has disconnected and the bridge is attempting to reconnect
- **THEN** the Settings panel shows a yellow "Reconnecting…" badge

#### Scenario: Bridge disconnected / HA not configured
- **WHEN** no HA config exists or the bridge has never successfully connected
- **THEN** the Settings panel shows a grey "Not connected" badge

#### Scenario: Auth failure
- **WHEN** the bridge receives `auth_invalid` from HA
- **THEN** the Settings panel shows a red "Auth error — check your token" badge
- **AND** the bridge does NOT attempt to reconnect (invalid credentials won't self-heal)
