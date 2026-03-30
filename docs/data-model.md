# Data Model

## Row Shape

```js
{
  id: number,
  character: string,
  category: '유니폼 필요' | '성장 필요' | '획득 필요',
  detail: string,
  done: boolean,
  priority: 1 | 2 | 3,
  usageType: '' | 'PVE' | 'PVP' | 'PVE/PVP'
}
```

## Row Rules

- Rows represent dynamic user tasks only
- `character` should correspond to a name in `src/characterData.js`
- `originType` is never stored in rows
- `acquisitionType`, `upgradeLevel`, and `baseUpgradeLevel` are never stored in rows
- `priority` is stored on the row and cycles through `1`, `2`, and `3`
- `usageType` is stored on the row and controls display filtering
- Duplicate rows are blocked only when `character`, `category`, and normalized stored `detail` are identical; `usageType` and `priority` do not affect duplicate detection
- For `획득 필요`, the stored `detail` is an empty string
- Existing rows can be edited, but duplicate validation still excludes the row being edited itself

## Allowed Form Values

```js
CATEGORY_OPTIONS = ['유니폼 필요', '성장 필요', '획득 필요']

DETAIL_OPTIONS = {
  '유니폼 필요': ['상시 판매', '한정'],
  '성장 필요': 'character-dependent'
}
```

- `획득 필요` does not use a detail select
- `성장 필요` detail options are derived from the selected character’s upgrade path
- If no growth options remain for the selected character, the UI shows `-` and prevents adding the row
- `태생캐 (2티)` and `태생캐 (2티, 더블)` hide `1티→2티`
- `태생캐 (3티)` hides both `1티→2티` and `2티→3티`
- Non-tier-born characters still show the full path to their max tier
- `4티` characters show the branch that matches `baseUpgradeLevel`
- `4티` + `3티` base uses `2티→3티` and `3티→4티`
- `4티` + `각초` base uses `2티→각초` and `각초→4티`
- Imported files are structurally validated and optional `usageType` and `priority` values are normalized during import

## Character Metadata Shape

```js
{
  '캐릭터 이름': {
    slug: string,
    originType: '일반캐' | '태생캐 (2티)' | '태생캐 (2티, 더블)' | '태생캐 (3티)',
    acquisitionType?: '수정캐' | '디럭스' | '엑조디아' | '매생/매엑',
    ctp?: '통찰' | '극복' | '탐욕' | '해방' | '분노' | '경쟁' | '파괴',
    iconUniformNumber?: number,
    upgradeLevel?: '2티' | '각초' | '3티' | '4티',
    baseUpgradeLevel?: '각초' | '3티'
  }
}
```

- `upgradeLevel` stores the highest displayed tier, including `2티` for characters capped at tier-2
- `baseUpgradeLevel` preserves the underlying `3티` or `각초` stage for characters that also have `4티`
- `acquisitionType` stores only displayable special acquisition labels: `수정캐`, `디럭스`, `엑조디아`, and `매생/매엑`
- `ctp` on character metadata is a display badge field with supported values `통찰`, `극복`, `탐욕`, `해방`, `분노`, `경쟁`, and `파괴`
- `iconUniformNumber` can pin a character to a known portrait number, and `0` means the base portrait
- `3티` and `각초` occupy the same display tier, so a character should only have one of them
- `4티` is shown together with `baseUpgradeLevel`, so 4티 characters render two tier badges
- Character-level CTP is editable from the character header, defaults to empty, and is stored separately from rows
- Character-level artifact is editable from the character header, defaults to off, and is stored separately from rows as a character-level toggle plus a 3 to 6 star level; if the artifact image does not exist for a character, the toggle remains locked on the placeholder
- Character-level CTP priority is editable from the character header, defaults to `!`, and is stored separately from rows

## Usage Model

- `usageType` is a row-level field, not character metadata
- Add Entry uses two toggle buttons, `PVE` and `PVP`, which can be selected independently
- When both add-entry toggles are on, the row stores `PVE/PVP`
- Priority is a row-level field with `1` through `3` rendered as `!`, `!!`, and `!!!`
- The bottom island starts with both usage toggles on
- The lower floating island filters the displayed rows by `PVE` and `PVP`
- When both island toggles are off, the view shows rows with no usage type
- Legacy mode-bucket storage is migrated into the canonical row list on load
- Uniform options are cached per character in `localStorage` under `mff_character_uniform_options_<slug>_v5`
- The `자동` icon choice uses that cache and refreshes only when the cache version changes or the user explicitly refreshes a character’s uniform list

## Name Matching

- UI validation uses `getCharacterEntry(name)` from `src/mffTrackerUtils.js`
- Matching ignores whitespace, dashes, punctuation, and case
- Multi-word names also accept initials-style abbreviations such as `미판`
- English/slug queries are accepted through each character’s `slug`
- Exact stored row values still use the user-selected character name string

## Search Model

- Character name search and metadata filters are separate UI controls
- Name search uses the same alias-aware lookup rules as validation
- Metadata search is structured through origin, acquisition, and tier filters
