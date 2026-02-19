# Deep Space D-6 — Game Design Document

> Reference document for the browser implementation. Covers all rules, card effects,
> station abilities, win/loss conditions, and design decisions made during development.

---

## Overview

**Deep Space D-6** is a solo dice game designed by Tony Go (Tau Leader Games). The player
commands the RPTR-class starship, which has answered a distress call in the Auborne system —
only to find it was a trap. Using crew dice assigned to ship stations, the player must survive
a relentless onslaught of threats until rescue arrives.

- **Players:** 1 (solo only)
- **Core mechanic:** Roll crew dice → assign to stations → use station abilities → survive
- **Win condition:** Work through the entire threat deck (culminating in Ouroboros) with all
  external threats destroyed
- **Loss conditions:** Hull reaches 0, or all 6 crew dice are in the Infirmary

---

## Components

### Ship — RPTR-class Starship

| Stat    | Starting Value |
| ------- | -------------- |
| Hull    | 8 HP           |
| Shields | 4 (max)        |

Shields absorb damage before hull. When a hit deals damage, reduce shields first; overflow
goes to hull. Science can recharge shields back to max.

### Crew Dice (6 dice)

Each die has six faces — one per crew role:

| Face        | Symbol | Station                |
| ----------- | ------ | ---------------------- |
| Commander   | ★      | Commander              |
| Tactical    | ✦      | Tactical               |
| Medical     | ✚      | Medical                |
| Science     | ◈      | Science                |
| Engineering | ⚙      | Engineering            |
| Threat      | !      | Scanners (auto-locked) |

A `Threat` face is never assigned voluntarily — any die that rolls `Threat` is automatically
locked to the **Scanners** station. For every 3 dice in Scanners, 1 extra threat card is drawn.

### Threat Die (1 die)

Six faces, each matching one of the threat activation symbols on cards:

| Symbol    | Icon |
| --------- | ---- |
| Skull     | ☠    |
| Lightning | ⚡   |
| Alien     | 👾   |
| Warning   | ⚠    |
| Hazard    | ☢    |
| Nova      | ✺    |

Rolled once per turn during the Activate phase. Any active threat card whose `activation`
symbol matches the result fires its activation effect.

### Threat Deck

Shuffled before each game. Contains:

- **Internal threats** — live aboard the ship; resolved by assigning specific crew dice
- **External threats** — attacking from outside; destroyed by Tactical fire
- **Filler cards** ("Don't Panic") — nothing happens; quantity depends on difficulty
- **Boss-Barrier** (Ouroboros Barrier) — must be destroyed before the final boss can be damaged
- **Boss** (Ouroboros) — always the last card in the deck; destroying it wins the game

---

## Stations

### Commander ★

Uses a Commander die. Choose ONE action:

- **Reroll:** Re-roll all dice currently in the pool. Any that come up `Threat` are auto-locked
  to Scanners and processed (extra draws if ≥3). Comms Offline blocks this ability.
- **Change:** Change any one pool die to any face of your choice. If changed to `Threat`, it
  auto-locks to Scanners. Comms Offline blocks this ability.

### Tactical ✦

Uses one or more Tactical dice. Each die deals **1 damage** to a chosen external threat.
Damage applies individually — you may split fire across multiple targets.

**Targeting restrictions:**

- Cannot target Ouroboros while the Ouroboros Barrier is active
- Orbital Cannon can only be targeted when it is the **only** active external threat
- Time Warp (while active): external threats cannot be reduced below **1 HP**

### Engineering ⚙

Uses one or more Engineering dice. Each die repairs **1 hull HP**, up to the maximum (8).
Engineering resolves automatically at end of the Assign phase (before drawing).

### Medical ✚

Uses one or more Medical dice. **Recovers all crew** currently in the Infirmary back to the
pool.

Special: If a Medical die is assigned during Scanner processing (when Scanners trigger extra
draws), it also frees one locked Scanner die back to the pool.

### Science ◈

Uses one or more Science dice. Choose ONE action:

- **Shields:** Recharge shields to maximum (4). Cannot be used while Nebula is active.
- **Stasis:** Place a stasis token on any active threat. The next time that threat would
  activate, the token is consumed instead and the activation is skipped.

### Scanners

Not directly assigned — Threat dice auto-lock here. Every 3 dice in Scanners triggers 1
additional threat card draw at the end of the Assign phase. Scanner-locked dice stay until
a Medical die is used (frees one per Medical die assigned).

### Infirmary

Holds incapacitated crew. Crew sent here cannot participate until Medical recovers them.
If all 6 crew dice end up in the Infirmary simultaneously, the game is lost.

---

## Setup

After shuffling the threat deck, **draw 2 threat cards** and place them in their corresponding
areas before the first turn begins. Their `immediateOnReveal` effects fire as normal.

## Turn Structure

Each turn follows six phases in order:

### Phase 1 — Roll

Roll all crew dice currently in the pool (dice not locked in Scanners or Infirmary).
Any that show `Threat` are immediately auto-locked to Scanners.
Scanner count is checked: every 3 Scanner dice triggers 1 extra card draw at end of Assign.

### Phase 2 — Assign (skipped in this implementation — roll immediately leads to assign)

> _In the physical game, Phase 2 is the roll itself. Phase 3 is assigning._
> _This implementation combines them: roll triggers auto-assignments, then player assigns._

### Phase 3 — Assign (interactive)

Select pool dice and assign them to stations. You may:

- Assign one die to a station to activate that station's ability
- Assign multiple dice to Tactical to fire multiple shots
- Use Commander to reroll or change a die (consuming the Commander die)
- Leave dice unassigned (they return to pool at Gather)

Dice assigned to stations (except Scanners) are returned to the pool at Gather phase.
Scanners-locked dice are NOT returned until freed by Medical.

Engineering auto-resolves at end of Assign: hull is repaired before the card draw.

### Phase 4 — Draw

One threat card is drawn from the top of the deck (plus any extras triggered by Scanners).

Card processing:

- **Filler ("Don't Panic"):** Discarded immediately; nothing happens.
- **Internal threat:** Added to active threats. If `immediateOnReveal`, its effect fires now.
- **External threat:** Added to active threats. If `immediateOnReveal`, its effect fires now.
- **Filler (Comms Offline active):** An extra card is also drawn.

The drawn card is displayed; player clicks **Continue** to proceed.

### Phase 5 — Activate

Roll the threat die. All active threats whose `activation` symbol matches the result fire
their effect. Stasis tokens on matching threats are consumed instead (activation skipped).

After clicking Continue, all activations resolve and the game checks win/loss.

### Phase 6 — Gather

All assigned crew dice return to the pool. Scanner-locked and Infirmary dice remain.
Turn counter increments. Return to Phase 1.

---

## Threat Card Catalogue

### Internal Threats

| Card                 | Activation   | Resolution                 | Effect on Activation                                                                                                       |
| -------------------- | ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Panel Explosion (×2) | Warning ⚠    | Engineering ×1             | Send 1 crew to Infirmary                                                                                                   |
| Distracted (×3)      | Nova ✺       | — (resolves on activation) | **Reveal:** Immediately lock 1 pool die here. **Activate:** Free the die; discard this card.                               |
| Friendly Fire (×2)   | Lightning ⚡ | Tactical ×1                | Deal 1 hull damage                                                                                                         |
| Boost Morale         | Nova ✺       | Commander ×1               | Return 1 crew from Infirmary                                                                                               |
| Nebula               | Hazard ☢     | Science ×2                 | **While active:** Shields cannot be recharged. **Activate:** Deal 1 shield damage                                          |
| Time Warp            | Nova ✺       | Science ×2                 | **While active:** External threats cannot be damaged below 1 HP. **Activate:** Shuffle top 3 discard cards back into deck. |
| Pandemic             | Hazard ☢     | Medical ×2                 | Send ALL pool crew to Infirmary                                                                                            |
| Spore: Infestation   | Alien 👾     | Medical ×1                 | Send 2 crew to Infirmary                                                                                                   |
| Robot Uprising       | Warning ⚠    | Tactical ×2                | Send 2 crew to Infirmary                                                                                                   |
| Comms Offline        | Lightning ⚡ | Engineering ×2             | **While active:** Commander station disabled. **Activate:** Draw 1 extra threat card.                                      |

**Resolution mechanics:** Assign the required die type and count directly to the threat card
(not to a station). When the requirement is fully met, the threat is resolved and discarded.
Resolved dice return to the pool.

**Distracted** is unique: it has no resolution die requirement. It locks a die on reveal
and frees it + discards itself on activation.

### External Threats

| Card                 | Activation   | HP  | Effect on Activation                                                                   |
| -------------------- | ------------ | --- | -------------------------------------------------------------------------------------- |
| Strike Bombers (×2)  | Lightning ⚡ | 3   | Deal 1 hull damage                                                                     |
| Scout (×2)           | Hazard ☢     | 2   | Deal 1 shield damage (or 1 hull if shields are 0)                                      |
| Pirates              | Skull ☠      | 4   | Deal 2 hull damage                                                                     |
| Space Pirates        | Skull ☠      | 5   | Deal 2 hull damage + 1 shield damage                                                   |
| Orbital Cannon       | Warning ⚠    | 6   | Deal 3 hull damage                                                                     |
| Solar Winds Flagship | Skull ☠      | —   | **Reveal:** Immediately deal 5 hull damage, then discard. Never enters active threats. |
| Hijackers            | Alien 👾     | 3   | Send 1 crew to Infirmary                                                               |

**Orbital Cannon** targeting restriction: can only be attacked by Tactical when it is the
**only** active external threat. This often forces players to clear other threats first.

**Solar Winds Flagship** resolves immediately on reveal — it never sits in active threats.
At 5 damage, it is the most dangerous single reveal in the deck.

### Boss

| Card              | Activation | HP  | Effect on Activation                           |
| ----------------- | ---------- | --- | ---------------------------------------------- |
| Ouroboros Barrier | Alien 👾   | 4   | Deal 2 hull damage + **regenerate to full HP** |
| Ouroboros         | Alien 👾   | 8   | Deal 3 hull damage                             |

The **Ouroboros Barrier** is a `boss-barrier` kind. While it is active and not destroyed,
Ouroboros cannot be targeted by Tactical. When the Barrier's HP reaches 0, it is
"destroyed" (flagged `isDestroyed`) but remains in play — it no longer blocks Ouroboros,
and no longer activates. It can regenerate if not fully destroyed before its activation
triggers (but a destroyed Barrier cannot activate).

**Ouroboros** is always the last card in the deck. Destroying it triggers the win condition.

### Filler

| Card                 | Count per Difficulty |
| -------------------- | -------------------- |
| Don't Panic (Easy)   | 6                    |
| Don't Panic (Normal) | 3                    |
| Don't Panic (Hard)   | 0                    |

Filler cards are discarded on draw with no effect.

---

## Passive Effects

Some internal threats impose a continuous ship-wide effect for as long as they remain active:

| Threat        | Passive Effect                                                      |
| ------------- | ------------------------------------------------------------------- |
| Nebula        | Science cannot recharge shields                                     |
| Comms Offline | Commander station disabled; activating it draws 1 extra threat card |
| Time Warp     | External threats cannot be reduced below 1 HP by Tactical fire      |

These effects apply immediately when the card enters play and lift the moment it is resolved or discarded.

---

## Win & Loss Conditions

### Win

After destroying Ouroboros (reduces to 0 HP via Tactical), check:

- Deck is empty (Ouroboros was the last card) AND
- No surviving external/boss threats remain

If both are true, status transitions to `won`. The win screen shows turns survived, time
elapsed, hull remaining, and difficulty.

In practice, because Ouroboros is always last, winning requires clearing all external
threats and destroying Ouroboros itself.

### Loss — Hull failure

Hull reaches 0. The RPTR is destroyed.

### Loss — Crew incapacitated

All 6 crew dice are simultaneously in the Infirmary. The ship drifts without anyone to operate it.
This is checked after any event that sends crew to the Infirmary.

---

## Difficulty Modes

| Mode   | Don't Panic Cards | Character                                         |
| ------ | ----------------- | ------------------------------------------------- |
| Easy   | 6                 | More breathing room between threat draws          |
| Normal | 3                 | Standard challenge                                |
| Hard   | 0                 | Relentless pressure — every draw is a real threat |

All other rules are identical. Deck size varies: 24 cards (Hard), 27 (Normal), 30 (Easy),
plus Ouroboros always last.
