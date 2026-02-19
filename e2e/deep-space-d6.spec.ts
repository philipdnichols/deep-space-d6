import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';
import type { GameAction } from '../src/state/actions';

const APP_URL = 'http://localhost:5173/deep-space-d6/';

function gameState(page: import('@playwright/test').Page): Promise<GameState> {
  return page.evaluate(() => (window as unknown as { __gameState: GameState }).__gameState);
}

function dispatch(page: import('@playwright/test').Page, action: GameAction): Promise<void> {
  return page.evaluate(
    (a) => (window as unknown as { __dispatch: (a: GameAction) => void }).__dispatch(a),
    action,
  );
}

test.describe('Deep Space D-6', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  // ── Idle state ────────────────────────────────────────────────────────────

  test('loads in idle state with title and launch button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Deep Space D-6' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Launch' })).toBeVisible();
    const state = await gameState(page);
    expect(state.status).toBe('idle');
  });

  test('shows the start screen flavour text', async ({ page }) => {
    await expect(page.getByText(/distress call/i)).toBeVisible();
  });

  // ── Difficulty selection ──────────────────────────────────────────────────

  test('difficulty defaults to Normal', async ({ page }) => {
    await expect(page.getByText(/standard challenge/i)).toBeVisible();
  });

  test('selecting Hard shows the correct description', async ({ page }) => {
    await page.getByRole('button', { name: 'Hard' }).click();
    await expect(page.getByText(/relentless threat pressure/i)).toBeVisible();
  });

  test('selecting Easy shows the correct description', async ({ page }) => {
    await page.getByRole('button', { name: 'Easy' }).click();
    await expect(page.getByText(/more breathing room/i)).toBeVisible();
  });

  // ── Starting a game ───────────────────────────────────────────────────────

  test('clicking Launch starts a game in rolling phase', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    const state = await gameState(page);
    expect(state.status).toBe('playing');
    expect(state.phase).toBe('rolling');
    expect(state.turnNumber).toBe(1);
  });

  test('header shows hull, shields, and Turn 1 after launch', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    await expect(page.getByText(/Turn 1/)).toBeVisible();
    // Hull and shields shown as "N/N" in the header
    await expect(page.getByText(/8\/8/)).toBeVisible();
    await expect(page.getByText(/4\/4/)).toBeVisible();
  });

  test('Roll Dice button is shown during rolling phase', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    await expect(page.getByRole('button', { name: /roll dice/i })).toBeVisible();
  });

  test('New Game button starts a fresh game from idle', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    await page.getByRole('button', { name: 'New Game' }).click();
    // New Game from within a game restarts without going idle
    const state = await gameState(page);
    expect(state.status).toBe('playing');
    expect(state.turnNumber).toBe(1);
  });

  // ── __TEST_LOAD_STATE ─────────────────────────────────────────────────────

  test('can load a won state via __TEST_LOAD_STATE', async ({ page }) => {
    const wonState: Partial<GameState> = {
      status: 'won',
      phase: 'gathering',
      difficulty: 'normal',
      hull: 5,
      maxHull: 8,
      shields: 2,
      maxShields: 3,
      crew: [],
      activeThreats: [],
      deck: [],
      discard: [],
      threatDieFace: null,
      selectedDieId: null,
      tacticalDice: [],
      log: [],
      lossReason: null,
      turnNumber: 7,
      elapsedSeconds: 300,
      drawnCard: null,
      nebulaActive: false,
      commsOfflineActive: false,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: wonState as GameState });
    await expect(page.getByText('Rescue Arrived')).toBeVisible();
    await expect(page.getByText(/play again/i)).toBeVisible();
    await expect(page.getByText(/turns survived: 7/i)).toBeVisible();
  });

  // ── Win/Loss screens ──────────────────────────────────────────────────────

  test('win screen shows rescue message and stats', async ({ page }) => {
    const wonState: Partial<GameState> = {
      status: 'won',
      phase: 'gathering',
      difficulty: 'hard',
      hull: 3,
      maxHull: 8,
      shields: 0,
      maxShields: 3,
      crew: [],
      activeThreats: [],
      deck: [],
      discard: [],
      threatDieFace: null,
      selectedDieId: null,
      tacticalDice: [],
      log: [],
      lossReason: null,
      turnNumber: 12,
      elapsedSeconds: 450,
      drawnCard: null,
      nebulaActive: false,
      commsOfflineActive: false,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: wonState as GameState });
    await expect(page.getByText('Rescue Arrived')).toBeVisible();
    await expect(page.getByText(/RPTR held together/i)).toBeVisible();
    await expect(page.getByText('Difficulty: Hard')).toBeVisible();
    await expect(page.getByText(/Hull remaining: 3\/8/)).toBeVisible();
  });

  test('loss screen shows hull failure message', async ({ page }) => {
    const lostState: Partial<GameState> = {
      status: 'lost',
      phase: 'activating',
      difficulty: 'normal',
      hull: 0,
      maxHull: 8,
      shields: 0,
      maxShields: 3,
      crew: [],
      activeThreats: [],
      deck: [],
      discard: [],
      threatDieFace: null,
      selectedDieId: null,
      tacticalDice: [],
      log: [],
      lossReason: 'hull',
      turnNumber: 5,
      elapsedSeconds: 180,
      drawnCard: null,
      nebulaActive: false,
      commsOfflineActive: false,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: lostState as GameState });
    await expect(page.getByText('Ship Lost')).toBeVisible();
    await expect(page.getByText(/critical hull failure/i)).toBeVisible();
    await expect(page.getByText('Difficulty: Normal')).toBeVisible();
  });

  test('loss screen shows crew loss message', async ({ page }) => {
    const lostState: Partial<GameState> = {
      status: 'lost',
      phase: 'rolling',
      difficulty: 'easy',
      hull: 4,
      maxHull: 8,
      shields: 1,
      maxShields: 3,
      crew: [],
      activeThreats: [],
      deck: [],
      discard: [],
      threatDieFace: null,
      selectedDieId: null,
      tacticalDice: [],
      log: [],
      lossReason: 'crew',
      turnNumber: 3,
      elapsedSeconds: 90,
      drawnCard: null,
      nebulaActive: false,
      commsOfflineActive: false,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: lostState as GameState });
    await expect(page.getByText('Ship Lost')).toBeVisible();
    await expect(page.getByText(/all crew incapacitated/i)).toBeVisible();
    await expect(page.getByText('Difficulty: Easy')).toBeVisible();
  });

  test('Play Again from win screen starts a new playing game', async ({ page }) => {
    const wonState: Partial<GameState> = {
      status: 'won',
      phase: 'gathering',
      difficulty: 'normal',
      hull: 6,
      maxHull: 8,
      shields: 2,
      maxShields: 3,
      crew: [],
      activeThreats: [],
      deck: [],
      discard: [],
      threatDieFace: null,
      selectedDieId: null,
      tacticalDice: [],
      log: [],
      lossReason: null,
      turnNumber: 8,
      elapsedSeconds: 200,
      drawnCard: null,
      nebulaActive: false,
      commsOfflineActive: false,
    };
    await dispatch(page, { type: '__TEST_LOAD_STATE', state: wonState as GameState });
    await page.getByRole('button', { name: /play again/i }).click();
    const state = await gameState(page);
    expect(state.status).toBe('playing');
    expect(state.turnNumber).toBe(1);
    expect(state.hull).toBe(8);
  });

  // ── Full turn cycle (without dice animations) ─────────────────────────────

  test('can complete a full turn via dispatched actions and UI buttons', async ({ page }) => {
    // 1. Start a game
    await page.getByRole('button', { name: 'Launch' }).click();
    await expect(page.getByRole('button', { name: /roll dice/i })).toBeVisible();

    // 2. Skip animation: dispatch ROLL_COMPLETE directly with all tactical faces
    //    Then wait for the UI to reflect the assigning phase (End Assignment button appears)
    await dispatch(page, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical'],
    });

    // 3. Assigning phase: End Assignment button appears
    await expect(page.getByRole('button', { name: 'End Assignment' })).toBeVisible();
    await page.getByRole('button', { name: 'End Assignment' }).click();

    // 4. Drawing phase: Continue button appears
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 5. Activating phase: Roll Threat Die button appears; skip animation
    await expect(page.getByRole('button', { name: /roll threat die/i })).toBeVisible();
    await dispatch(page, { type: 'THREAT_ROLL_COMPLETE', face: 'nova' });
    // nova activates no threats in a fresh game, Continue appears
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 6. Gathering phase: Gather Crew button appears
    await expect(page.getByRole('button', { name: /gather crew/i })).toBeVisible();
    await page.getByRole('button', { name: /gather crew/i }).click();

    // 7. Back to rolling — Roll Dice button reappears and header shows Turn 2
    await expect(page.getByRole('button', { name: /roll dice/i })).toBeVisible();
    await expect(page.getByText(/Turn 2/)).toBeVisible();
  });

  // ── Phase labels and instructions ────────────────────────────────────────

  test('shows correct phase label during assigning', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    await dispatch(page, {
      type: 'ROLL_COMPLETE',
      faces: ['engineering', 'medical', 'science', 'tactical', 'commander', 'engineering'],
    });
    await expect(page.getByText('Phase 3 — Assign')).toBeVisible();
  });

  test('shows correct phase label during activating', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    await dispatch(page, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical'],
    });
    await page.getByRole('button', { name: 'End Assignment' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Phase 5 — Activate')).toBeVisible();
  });

  // ── Deck / discard counters ───────────────────────────────────────────────

  test('deck counter decreases after ending assignment phase', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch' }).click();
    const initialState = await gameState(page);
    const initialDeckSize = initialState.deck.length;

    await dispatch(page, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'tactical', 'tactical', 'tactical', 'tactical'],
    });
    await page.getByRole('button', { name: 'End Assignment' }).click();

    const afterState = await gameState(page);
    // At least one card was drawn
    expect(afterState.deck.length).toBeLessThan(initialDeckSize);
  });
});
