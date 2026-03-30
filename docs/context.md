# Project Context

Marvel Future Fight tracker for managing per-character tasks in a single-page React UI.

## Current Scope

- Track three task categories: `유니폼 필요`, `성장 필요`, `획득 필요`
- Store rows separately from character metadata
- Render the same rows in `Character View` and `Category View`
- Render a `Character List` view that shows only which characters appear in the current filtered rows
- Character View and Character List keep separate sort controls; Character View defaults to `Last Added` and Character List defaults to `Name`
- Persist rows in `localStorage`
- Support JSON import/export
- Show a character icon, usage badge, origin badge where applicable, acquisition badge, and upgrade badges wherever a character is rendered

## Source Of Truth

- Static character metadata lives in `src/characterData.js`
- Task behavior and grouping helpers live in `src/mffTrackerUtils.js`
- Main UI state and interactions live in `src/MFFTrackerUI.jsx`
- Character icon, upgrade badge, acquisition badge, usage badge, and origin badge rendering live in `src/CharacterComponents.jsx`

## Character Metadata

Each character entry can include:

- `slug`
- `originType`
- `acquisitionType` for special display-only acquisition labels
- `ctp` for a CTP badge using one of `통찰`, `극복`, `탐욕`, `해방`, `분노`, `경쟁`, `파괴`, `제련`, `권능`, `심판`, `재생`, `역전`, `격동`, `인내`, or `초월`
- CTP inputs can be normalized from the English aliases `Insight`, `Conquest`, `Greed`, `Liberation`, `Rage`, `Competition`, `Destruction`, `Refinement`, `Authority`, `Judgement`, `Regeneration`, `Veteran`, `Energy`, `Patience`, and `Transcendence`
- `iconUniformNumber` when a character needs a pinned portrait number (`0` means the base portrait)
- `upgradeLevel` for the highest visible tier label
- `baseUpgradeLevel` for characters whose visible tier is `4티`

Rows are saved as a single canonical list. `usageType` lives on each row and controls usage filtering.
`priority` also lives on each row and stores a 1-to-3 urgency level rendered as `!`, `!!`, or `!!!`.
Character CTP is edited from the character header, is stored as a separate local UI override, and does not live on rows.

Current `originType` values:

- `일반캐`
- `태생캐 (2티)`
- `태생캐 (2티, 더블)`
- `태생캐 (3티)`

Current `acquisitionType` values shown in the UI:

- `수정캐`
- `디럭스`
- `엑조디아`
- `매생/매엑`

`upgradeLevel` is the displayed top tier. Characters capped below `4티` store a single level badge. Characters at `4티` also keep `baseUpgradeLevel` so the UI can show the underlying `3티` or `각초` badge next to the max tier badge.

Upgrade badges are rendered from these icons:

- `2티` -> `https://thanosvibs.money/static/attributes/t2.png`
- `각초` -> `https://thanosvibs.money/static/attributes/tp.png`
- `3티` -> `https://thanosvibs.money/static/attributes/t3.png`
- `4티` -> `https://thanosvibs.money/static/attributes/t4.png`

## Icons

- Character icons come from `https://thanosvibs.money/static/assets/portraits_128/` and the icon itself opens a per-character uniform picker with `기본`, `자동`, and numbered uniforms
- Uniform selections are stored per character in `mff_character_uniform_overrides_v1` and can be cleared back to automatic newest resolution
- The app checks available uniform images lazily with a timeout so the picker does not get stuck on loading
- Resolved uniform numbers are cached in `localStorage` with `mff_latest_uniform_<slug>_v3`
- If no icon can be resolved, the UI falls back to the character’s first letter

## Persistence

- Rows are stored under `mff_tracker_rows_v2`
- Theme preference is stored under `mff_tracker_theme_v1`
- Legacy rows from `mff_tracker_rows_v1` and the old mode buckets are migrated when present
- Initial state is an empty array when nothing is saved or parsing fails
- Saving happens whenever `rows` changes

## Reset And Import Behavior

- Reset is a two-step confirmation button, not a native double-click action
- Confirmation expires after 3 seconds
- Reset clears rows, filters, and legacy storage keys, then writes an empty array to storage
- Import accepts a JSON array of row-shaped objects only
- Import validation is structural only; it does not verify character names or allowed detail values
- Import accepts optional `usageType` fields and normalizes missing values
- Existing saved rows tagged `PVE` or `PVE/PVP` are migrated once to `PVP` for the current saved dataset

## Row Editing

- Existing rows can be edited in a modal editor
- The editor can change row detail, completion state, row-level usage type, and row priority
- Duplicate checks still apply during edits, excluding the row being edited itself

## Name Matching

- Character lookup ignores whitespace, dashes, punctuation, and case
- Multi-word names support initials-style aliases for search and add-entry lookup
- English/slug queries are also accepted through each character’s `slug`
- Canonical stored names still come from `src/characterData.js`

## Search

- Character search and metadata filters are separate in the UI
- Name search is alias-aware, matches the character lookup rules, accepts English/slug queries, and lives in the results header next to the grouping title
- The main results view also shows removable filter chips for active search and metadata filters, including origin, acquisition, tier, category, category-scoped detail, and icon-based CTP chips
- The full filter stack lives in a left-edge drawer so the left column stays usable, and its floating edge tab only appears while the drawer is closed
- The Add Entry character field shows a small status chip next to the preview icon so you can tell whether the selected character already has tracked rows, and that preview defaults to the newest portrait unless you choose another uniform
- A `!` badge beside the search bar cycles the minimum priority threshold for filtered rows
- The character dropdown supports Arrow Up/Down and Enter selection while it is open
- When a searched character has no tracked rows yet, the character view shows a quick-add prompt that pre-fills the add form
- Metadata search is structured through multi-select chip filters for origin type, acquisition label, tier, and icon-based CTP chips, while category uses multi-select chips and detail is filtered by category/detail pairs
- Category View displays the canonical Korean character name even if the stored row used a slug or English alias

## Usage Filter

- The floating bottom island is a frosted PVE/PVP usage filter
- Both toggles are on by default
- Both toggles can be on, or both can be off
- The island label shows `All` when both toggles are on, and that state includes rows with no usage type
- The island label shows `PVE only` or `PVP only` when exactly one toggle is on
- When both toggles are off, the view shows rows with no usage type
- The island label shows `None` when both toggles are off
- The filter changes what is displayed, not where rows are stored
- Add Entry has its own independent PVE/PVP toggle pair beside the title for the row being created
- Character headers show an optional CTP picker; it defaults to empty for characters without a character-level CTP value, and the trigger is styled like plain display rather than a form control

## Growth Detail Rules

- `성장 필요` detail options are character-dependent and only allow one branch per character; `2티→3티` and `2티→각초` are mutually exclusive for a given character
- The dropdown only shows progressions up to the selected character’s maximum upgrade path
- Tier-born characters do not show upgrades below their starting tier
- If a character has no remaining growth steps, the detail field shows `-` and the row cannot be added
- `2티` characters only show `1티→2티`
- `태생캐 (2티)` and `태생캐 (2티, 더블)` hide `1티→2티`
- `태생캐 (3티)` hides both `1티→2티` and `2티→3티`
- Non-tier-born characters still show the full path to their max tier
- `4티` characters show the branch that matches `baseUpgradeLevel`
- `4티` + `3티` base uses `2티→3티` and `3티→4티`
- `4티` + `각초` base uses `2티→각초` and `각초→4티`

## For Later

- PVE-only background shows different color
