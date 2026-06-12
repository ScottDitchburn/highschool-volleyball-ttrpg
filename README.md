# Haikyū: Gauntlet RPG v2 — Character Builder

A web-based character builder for the Haikyū: Gauntlet RPG v2 tabletop system.
Hosted on GitHub Pages; source in this repository.

**Live site:** `https://<username>.github.io/<repo>/` *(URL to be filled in after first deploy)*

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (hot-reload)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

Requires Node 20+.

---

## Editing abilities data

All ability definitions live in a single source-of-truth file:

```
src/data/abilities.ts
```

Each entry follows the `Ability` interface defined in `src/types.ts`. The
schema covers: `id`, `name`, `baseCost`, `prereqs`, `tiers`, `effects`, `meta`,
and `notes`.

When you add, modify, or interpret a rule from the source document, **add a
corresponding entry to `DATA_NOTES.md`** explaining your decision. This keeps
the builder auditable against the WIP rules document.

---

## Project structure

```
src/
  data/           Single-source ability definitions (abilities.ts)
  engine/         Prereq evaluator, AP calculator, effective-stat computer
  components/     Shared UI components (CharacterSheet, DiceRoller, etc.)
  steps/          One file per wizard step
  state/          characterStore.ts — React context + reducer
  types.ts        All domain types and conversion helpers
  App.tsx         Wizard shell + step routing
  main.tsx        React entry point
  index.css       Tailwind directives + design tokens
```

---

## Deploy

The GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on every
push to `main`, builds the app with Node 20, and deploys `dist/` to GitHub Pages.

Enable GitHub Pages in **Settings → Pages → Source: GitHub Actions** before the
first push.
