# CLAUDE.md

Character builder for the **Haikyū: Gauntlet RPG v2** tabletop system. React + Vite + Tailwind SPA, deployed on Vercel.

- Repo: https://github.com/ScottDitchburn/highschool-volleyball-ttrpg
- Live: https://washioisbae.vercel.app/

## Commands

```bash
npm run dev      # dev server (hot reload)
npm run build    # tsc -b && vite build -> dist/
npm test         # vitest run
npm run lint     # eslint
```

Node 20+.

## Key locations

- [src/data/abilities.ts](src/data/abilities.ts) — single source of truth for all ~40 abilities. Schema is the `Ability` type in [src/types.ts](src/types.ts).
- [src/engine/](src/engine/) — `prereqEngine.ts` (effective stats + prereq validation), `apEngine.ts` (Ability Point budget).
- [src/steps/](src/steps/) — one file per wizard step (Physical → Reaches → Skills → Year/Experience → Abilities → Review).
- [src/state/characterStore.tsx](src/state/characterStore.tsx) — React context + reducer; [persistence.ts](src/state/persistence.ts) handles localStorage + JSON import/export.
- [src/charts/](src/charts/) — hand-rolled SVG distribution/radar charts and `distributions.ts` (3d10 convolution maths).
- [src/export/](src/export/) — print sheet, PDF, Discord code-block export.
- [src/__tests__/](src/__tests__/) — vitest engine + UI tests.

## Reference docs

- [PLAN.md](PLAN.md) — locked design decisions, system model (stat/reach/AP formulas), screen-by-screen UX. Read this for game rules.
- [DATA_NOTES.md](DATA_NOTES.md) — every interpretation of the WIP rules source. **Update it whenever you add or change an ability in `abilities.ts`.**
- `Haikyu_ Gauntlet RPG v.2.md` — the raw WIP rules document.

## Conventions

- `abilities.ts` is data-only; encode rules there and log any interpretation in `DATA_NOTES.md`.
- Deploy is automatic via **Vercel** on every push to `main` (https://washioisbae.vercel.app/). The legacy [.github/workflows/deploy.yml](.github/workflows/deploy.yml) Pages workflow is superseded.
