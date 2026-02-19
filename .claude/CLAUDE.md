# Deep Space D-6 — Claude Instructions

## Before Every Commit and Push

Always run the full CI suite locally before pushing — these match the GitHub Actions `ci` job exactly:

```bash
npm run lint
npm run format:check
npm run test:coverage
npm run test:e2e
```

Never push without running all four. If any step fails, fix it before pushing.

> **Note:** The workflow uses `concurrency: cancel-in-progress: true`. Pushing a second commit while the first run is still in-flight cancels it — always verify the latest workflow run completes successfully.

## Keeping Documentation Updated

- **`GAME.md`** — update whenever rules are corrected, mechanics are added, or the implementation diverges from what is documented
- **`CLAUDE.md`** — update whenever project conventions change

## Project Conventions

- Use `npm run test:coverage` (not `npm test`) — coverage must meet the thresholds in `vitest.config.ts`
- Run `npm run format` to auto-fix Prettier before running `format:check`
- TypeScript strict mode: no `any`, no unused locals or parameters
