# Polyweb

A small isometric, turn-based strategy game that runs in the browser, inspired by *The Battle of Polytopia*
(original art and code; not affiliated with Midjiwan). No build step, no dependencies.

## Play

Open `index.html` in a browser, or serve the folder (`python3 -m http.server`).
On GitHub: **Settings → Pages → Source: GitHub Actions**. The included workflow then publishes the game on every push to `main`.

## How to play

- **Goal:** capture every rival city. You lose if you lose all of yours.
- **Move / attack:** tap a unit, then a highlighted tile (white = move, red = attack). A unit can move then attack; attacking ends its turn.
- **Villages 🏘️:** walk a unit onto one to claim it. Walk onto an empty enemy city to capture it.
- **Cities:** produce ⭐ per turn equal to their level. Select a city with no unit on it to train Warriors, Archers (range 2), Riders (move 2) or Defenders.
- **Harvest** 🍎/🦌 inside your borders (⭐2) to grow population. Full population levels a city up (more income; larger borders at level 3).
- Idle units heal. Cities and forests give defence bonuses. Mountains are impassable. Fog hides unscouted land.
- **Controls:** drag to pan, wheel/pinch to zoom, `E` ends turn, `Esc` deselects. The game autosaves each turn.

## Files

- `index.html`, `style.css`: UI shell
- `game.js`: map generation, rules, AI and canvas rendering
