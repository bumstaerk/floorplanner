## ADDED Requirements

### Requirement: Export plan to file
The system SHALL allow the user to download the current plan as a `.fpjson` file containing all plan data and images as embedded base64.

#### Scenario: Export downloads a file
- **WHEN** the user clicks the Export button in the toolbar
- **THEN** the browser downloads a `.fpjson` file named after the current plan (e.g., `my-house.fpjson`, falling back to `floorplan.fpjson`)

#### Scenario: Exported file contains complete plan data
- **WHEN** a `.fpjson` file is exported
- **THEN** it contains all floors, corners, walls, openings, components, room names, staircase openings, and floorplan images (base64-encoded)

#### Scenario: Export includes a format version
- **WHEN** a `.fpjson` file is exported
- **THEN** it includes a `formatVersion` field set to `1`

### Requirement: Import plan from file
The system SHALL allow the user to upload a `.fpjson` file, which is saved as a new plan and immediately loaded into the editor.

#### Scenario: Import creates a new plan
- **WHEN** the user selects a valid `.fpjson` file via the Import button
- **THEN** the plan is saved to the database with a new unique ID and loaded into the editor

#### Scenario: Import does not overwrite existing plans
- **WHEN** a `.fpjson` file is imported
- **THEN** any existing plans remain unchanged and the imported plan is saved as a new entry

#### Scenario: Import rejects invalid files
- **WHEN** the user selects a file that is not valid `.fpjson` (malformed JSON or missing required fields)
- **THEN** an error message is shown and no plan is created
