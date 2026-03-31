# MFF Tracker

Marvel Future Fight tracker for managing character tasks in a compact React UI.

![MFF Tracker screenshot](./public/images/mff-tracker-screenshot.png)

## What It Does

- Tracks three task categories: `유니폼 필요`, `성장 필요`, and `획득 필요`
- Supports `Character Tracking`, `Category View`, and `Tracking List`
- Keeps rows separate from static character metadata
- Saves data in `localStorage`
- Supports file import and export, including a wrapper export format that preserves character-level CTP type and rarity, CTP priority, and artifact overrides
- Includes filters for name, origin, acquisition, tier, CTP, category, detail, usage, and priority

## Sample Import

A ready-to-import example is available at [`public/sample-import.json`](./public/sample-import.json). It includes rows that demonstrate:

- `유니폼 필요`, `성장 필요`, and `획득 필요`
- `PVE`, `PVP`, `PVE/PVP`, and no usage type
- priority levels from `!` to `!!!`
- completed and incomplete rows

## Features

- Character icons with per-character uniform selection
- Tier badges for `2티`, `각초`, `3티`, and `4티`
- Acquisition labels such as `공헌도`, `수정캐`, `디럭스`, `엑조디아`, and `매생/매엑`
- Character-level CTP display and picker with Regular/Mighty/Brilliant rarity
- Character-level artifact toggle plus star level
- Row-level usage flags for `PVE` / `PVP`
- Row priority levels from `!` to `!!!`
- Drag and drop in `Category View` within the same category
- Quick add flow when a searched character has no rows yet

## Tech Stack

- React 19
- Vite

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

This is a static Vite app. The simplest deployment path is:

1. Push the repo to GitHub.
2. Import the repo into Vercel or Netlify.
3. Use `npm run build` as the build command.
4. Use `dist` as the output directory.

## Notes

- Character metadata lives in `src/characterData.js`
- Main UI state lives in `src/MFFTrackerUI.jsx`
- Shared tracker logic lives in `src/mffTrackerUtils.js`
- Reusable character rendering lives in `src/CharacterComponents.jsx`
