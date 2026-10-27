# Polyweb

A turn-based isometric strategy game for the browser, inspired by *The Battle of Polytopia*.
It has original art and code and is not affiliated with Midjiwan. There is no build step and no dependencies.

## Play

- **Locally:** open `index.html`, or serve the folder (`python3 -m http.server`) and visit `http://localhost:8000`.
- **GitHub Pages:** `.github/workflows/pages.yml` deploys the game on every push to `main`. Turn it on under
  **Settings → Pages → Source: GitHub Actions**. Pages on a private repository needs a paid GitHub plan; on the free plan, make the repository public first.

## Features

- **Six tribes** (Zephyr, Ember, Verdant, Solis, Granite, Frost), each starting with a different technology.
- **2–6 tribes** on 12×12 to 24×24 maps: Continents, Pangea or Archipelago.
- **Game modes:** Domination (last tribe standing) and Perfection (highest score after 30 turns).
- **Difficulty:** Easy, Normal, Hard, Crazy (computer income bonus).
- **Pass and play:** set any extra player to Human to play hot-seat on one device, with a hand-over screen between turns.
- **Tech tree** of 15 technologies in five branches: Riding, Organization, Climbing, Fishing, Hunting.
- **Units:** Warrior, Rider, Archer, Defender, Swordsman, Knight, Catapult and the Giant super unit. Units board boats on shallow water (Sailing) and become ships that cross the ocean (Navigation).
- **Cities** grow by harvesting fruit, animals and fish or building farms, mines, lumber huts and ports. Every level offers a reward choice: workshop or explorer, walls or resources, population or border growth, park or Giant.
- **Ruins** hold treasure, free technology, maps or a veteran swordsman.
- **Combat** uses attack/defence/health with city, wall, forest and mountain bonuses. Melee winners advance, idle units heal, and three kills make a veteran.
- **Fog of war**, unit limits per city, computer opponents that research, build, expand and use boats.
- **Autosave** to the browser after every turn, sound effects with a mute toggle, mouse and touch controls.

## Controls

Drag to pan, scroll or pinch to zoom. Tap a unit, then a white tile to move or a red tile to attack.
Keyboard: `E` end turn, `N` next unit, `T` technology, `Esc` close or deselect.

## Files

- `index.html`, `style.css`: page shell, menus and HUD
- `game.js`: map generation, rules, computer players, rendering and input
