# MFF Tracker - Agent Rules

## Editing Rules
- Always make minimal patches
- NEVER rewrite entire files unless explicitly asked
- ALWAYS specify EXACT insertion/replacement location
- Prefer incremental safe changes

## Code Structure
- UI: src/MFFTrackerUI.jsx
- Data: src/characterData.js
- Rows = dynamic tasks
- characterData = static metadata

## Critical Constraints
- Do NOT duplicate metadata into rows
- originType belongs ONLY in characterData
- Character names must match characterData

## Features Implemented
- LocalStorage persistence
- Import/Export JSON
- Lazy icon detection (thanosvibs)
- Reset requires confirmation (double click)

## UI Rules
- Icon must be displayed for each character
- originType badge shown next to name
- Badge colors:
  - 매생캐 → blue
  - 일반캐 → gray
  - 태생캐 → black

## Form Rules
- Detail is category-dependent select
- No free text detail
- 획득 필요 handled separately

## Validation Rules
- No silent failures
- Always show error messages

## Documentation Rule
- If code behavior changes, update docs/*.md accordingly
- Docs must always reflect current implementation

## Priority
If conflicts occur:
1. Data integrity
2. Minimal patch
3. UI consistency