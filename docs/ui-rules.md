# UI Rules

## Layout

- The page uses a two-column desktop layout with controls on the left and results on the right
- The left control column stays sticky while scrolling on desktop and scrolls internally when needed
- Users can switch between `Character View`, `Category View`, and `Character List`
- Users can toggle between light and dark theme
- Users can toggle between Korean and English, with Korean as the default language
- Light theme keeps the default black borders and bright white surfaces
- Dark theme uses gray surfaces, softened borders, and softened dark buttons instead of pure black/white contrast
- The theme toggle is an emoji-style button that shows the current mode with a sun for light mode and a moon for dark mode, and the sun state uses a light yellow background
- Character view defaults to sorting by `lastAdded`
- Character view supports sorting by `name`, `origin`, `acquisition`, `tier`, `lastAdded`, `priority`, `completion`, or `tasks`
- Character view includes a small direction toggle beside the sort dropdown
- A small `!` priority badge sits beside the search bar and cycles the minimum priority threshold
- Origin sorting uses origin type first, then upgrade tier, then acquisition label, then name
- Acquisition sorting groups by acquisition label first, then origin type
- Tier sorting uses the highest visible tier first, then acquisition label
- Last-added sorting uses the newest row id in each character group first
- Priority sorting uses the highest row priority in the group first
- Category view orders groups as `획득 필요`, then `성장 필요`, then `유니폼 필요`; inside each group it sorts items by priority first and renders compact inline chips with icon, name, acquisition badge, origin badge when applicable, priority badge, and usage badge only
- The bottom island-style usage filter is a frosted floating pill with independent `PVE` and `PVP` toggles
- Both toggles are on by default
- Both toggles can be on, or both can be off
- The island label shows `All` when both toggles are on, and that state includes rows with no usage type
- The island label shows `PVE only` or `PVP only` when exactly one toggle is on
- When both toggles are off, the view shows only rows with no usage type
- The bottom island changes which rows are displayed, not how rows are stored

## Character Presentation

- Every rendered character entry should include a `CharacterIcon`
- Character names should display `CharacterUpgradeBadges` when metadata exists
- `4티` characters show the `4티` badge plus their `baseUpgradeLevel` badge
- Character names should display `CharacterAcquisitionBadge` when acquisition metadata exists
- Character names should display `CharacterCTPBadge` when the character metadata has a supported `ctp` subtype such as `통찰`, `극복`, `탐욕`, `해방`, `분노`, `경쟁`, `파괴`, `제련`, `권능`, `심판`, `재생`, `역전`, `격동`, `인내`, or `초월`
- CTP badges are larger, borderless, and glow brightly with a type-colored shadow to signal priority
- Character headers should include an optional CTP picker; it defaults to empty for characters without a CTP value, and the trigger should read like plain display rather than a visible form control
- Character names should display `CharacterOriginBadge` only for tier-born origin types; `일반캐` is not rendered as a badge
- Character rows should display a priority badge that cycles through `!`, `!!`, and `!!!`
- Row cards should display `CharacterUsageBadge` for the row-level `usageType`
- Character icons use a dark fallback tile in light mode and a light fallback tile in dark mode; clicking the icon opens a uniform picker with `기본`, `자동`, and numbered uniforms, and add-entry previews default to the newest uniform
- The uniform picker is driven from the character icon itself, persists per character, and keeps the base portrait available as a selectable option
- In `Category View`, clicking a category entry toggles its completed state directly; the row uses line-through and a soft background instead of lowering opacity, so nested controls stay readable
- In `Category View`, entries can be dragged only within the same category to a different detail group; cross-category drops are ignored, and growth entries only accept destination detail groups that are valid for that character’s allowed growth branch
- If icon lookup fails, show a text fallback avatar

## Origin Badge Styles

- `태생캐 (2티)` → gray with a soft glow
- `태생캐 (2티, 더블)` → dark gray/near-black with a stronger glow
- `태생캐 (3티)` → yellow with a glow

## Acquisition Badge Styles

- `수정캐` → sky
- `디럭스` → violet with a glow
- `엑조디아` → orange with a glow
- `매생/매엑` → black

## Upgrade Badge Styles

- `4티` → soft red background with a near-full icon fill
- `3티` → gold-toned background with a near-full icon fill
- `각초` → soft purple background with a near-full icon fill
- `2티` → soft silver background with a near-full icon fill

## Form Behavior

- Character input is a searchable text field with dropdown suggestions from `characterNames`
- A character icon preview appears beside the input when the current value resolves to known metadata, and a small status chip shows whether the character already has tracked rows or is still new; the icon itself opens a uniform picker
- Add Entry has two independent usage toggle buttons, `PVE` and `PVP`, placed beside the section title
- When both Add Entry usage toggles are on, the row stores `PVE/PVP`
- Category selection updates the available detail options
- `성장 필요` detail options are filtered by the selected character’s origin tier and max upgrade path; a character can only use one growth branch, so `2티→3티` and `2티→각초` cannot both be valid for the same character
- If no valid growth step remains, the detail field shows `-` and the add action is blocked
- `Detail` is shown only when category is not `획득 필요`
- No free-text detail input exists

## Validation And Feedback

- Invalid or missing character input shows an inline error
- Missing detail shows an inline error when detail is required
- Duplicate entries show a general error message
- Duplicate validation ignores `PVE` / `PVP`; identical character/category/detail rows cannot be added twice
- Successful adds show a temporary success message
- Import failures are surfaced with `window.alert`

## Row Interaction

- Character view uses a custom button-style completion toggle
- Category view uses a native checkbox
- Completed items are visually dimmed or struck through
- Each row has a delete action
- Each row has an edit action that opens a modal editor for detail, completion, usage type, and priority

## Filters And Utilities

- Search is split into a character name/alias field in the results header and structured metadata filters in the sidebar; origin, acquisition, tier, and category use multi-select chip filters, detail uses category-scoped pair chips, and CTP uses icon chips
- Visible labels, badges, and helper text should follow the current UI language where the code supports it
- The filters live in a left-edge drawer to keep the left column from feeling overloaded, and the floating `Filters` tab only appears when the drawer is closed
- Name search matches the alias-aware character lookup rules, including English/slug queries
- Character search dropdown supports Arrow Up/Down and Enter selection while it is open
- When the search matches a character with no tracked rows, character view shows a quick-add prompt that pre-fills the add form
- Character View and Character List each have their own `Sort by` state; Character View defaults to `Last Added` and Character List defaults to `Name`
- Character List shows only the characters present in the current filtered rows
- Metadata search uses multi-select chip filters for origin type, acquisition label, and tier, plus icon chips for CTP
- Category filters are multi-select chip groups
- Detail filters are category-scoped pair chips and can be cleared independently
- Usage filtering is handled separately by the floating bottom island
- Category filter options are derived from the current rows, prefixed with `전체`
- `Show completed entries` hides completed rows when disabled
- Import JSON, Export JSON, and Reset actions live in the filter/utilities section
- Reset requires a second click within 3 seconds
- A small credit footer appears at the bottom of the page

## Embedded Sanity Tests

- The sidebar has a toggleable sanity-test panel from `runSanityTests()`
- The panel is hidden by default
- These are UI-visible helper checks, not a full automated test suite
