# Deep Space D-6

A browser implementation of the solo dice game [Deep Space D-6](https://www.tantogames.com/deep-space-d-6) by Tony Go (Tau Leader Games).

**Play it now:** https://philipdnichols.github.io/deep-space-d6/

---

## What is it?

You command the RPTR-class starship. It answered a distress call in the Auborne system. It was a trap. Roll crew dice, assign them to ship stations, fend off an escalating wave of threats, and survive long enough for rescue to arrive.

- **Solo only** — pure single-player
- **Turn-based** — Roll → Assign → Draw → Activate → Gather
- **Deck-driven** — each turn reveals a new threat; Ouroboros is always the last card

See [GAME.md](./GAME.md) for the complete rules, card catalogue, and station descriptions.

---

## How to Play

1. Choose a difficulty (Easy / Normal / Hard — controls how many "Don't Panic" filler cards pad the deck) and click **Launch**
2. Each turn:
   - **Roll** your crew dice
   - **Assign** them to stations — Engineering repairs hull, Tactical shoots threats, Science recharges shields or stasis, Medical recovers crew, Commander rerolls or changes a die
   - Click **End Assignment** — engineering auto-resolves, then a threat card is drawn
   - **Continue** past the draw — threats activate on matching threat-die symbols
   - **Gather** crew back to the pool and start the next turn
3. Win by working through the entire deck and destroying Ouroboros
4. Lose if hull hits 0 or all 6 crew end up in the Infirmary

---

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 19 + TypeScript (strict) |
| Build | Vite |
| Unit tests | Vitest (209 tests, 97.7% statement coverage) |
| E2E tests | Playwright (18 tests, Chromium) |
| Lint/format | ESLint 9 flat config + Prettier |
| Deploy | GitHub Actions → GitHub Pages |

---

## Development

```bash
npm install
npm run dev          # start dev server
npm test             # unit tests
npm run test:e2e     # Playwright e2e tests (requires dev server)
npm run test:coverage  # unit tests + coverage report
npm run lint         # ESLint
npm run format       # Prettier --write
```
