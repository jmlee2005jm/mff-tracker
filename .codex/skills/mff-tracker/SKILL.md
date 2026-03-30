---
name: mff-tracker
description: >
  Use this when editing the Marvel Future Fight tracker.
  Applies rules for UI, data model, and minimal patch workflow.
---

# Behavior

Always:
- Read AGENTS.md first
- Use docs/context.md as source of truth
- Make minimal patches
- Specify exact insertion location

# Data Rules

- characterData is the only source of metadata
- rows must not duplicate metadata
- originType is NOT stored in rows

# UI Rules

- Keep layout stable
- Do not redesign UI unless asked
- Preserve Tailwind styling

# Icons

- Use thanosvibs
- Prefer lazy detection
- Cache results

# Forms

- Use category-dependent detail select
- No free text
- Validate inputs visibly

# Persistence

- Use localStorage
- Do not break existing saved data

# When unsure

Ask for clarification BEFORE making large changes