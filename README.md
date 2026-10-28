# Polyweb

A turn-based isometric strategy game for the browser, inspired by *The Battle of Polytopia*.
It has original art and code and is not affiliated with Midjiwan. There is no build step and no dependencies.

## Play

- **Locally:** open `index.html`, or serve the folder (`python3 -m http.server`) and visit `http://localhost:8000`.
- **GitHub Pages:** `.github/workflows/pages.yml` deploys the game on every push to `main`. Turn it on under
  **Settings → Pages → Source: GitHub Actions**. Pages on a private repository needs a paid GitHub plan; on the free plan, make the repository public first.

## Features

- **Ten tribes**, each starting with a different technology: Zephyr, Ember, Verdant, Solis, Granite and Frost, plus Ashen (volcanoes), Blossom (cherry-blossom valleys), Mire (mushroom swamps) and Lumen (crystal highlands).
- **2–8 tribes** on 12×12 to 24×24 maps: Continents, Pangea or Archipelago.
- **Lighthouses** in the four corners of every map. The first sighting of each earns stars and points.
- **Game modes:** Domination (last tribe standing) and Perfection (highest score after 30 turns).
- **Difficulty:** Easy, Normal, Hard, Crazy (computer income bonus).
- **Pass and play:** set any extra player to Human to play hot-seat on one device, with a hand-over screen between turns. Each player picks a tribe from the full illustrated tribe gallery.
- **Tech tree** of 35 technologies. The first 25 are laid out like Polytopia's: Riding → Roads → Trade and Free Spirit → Chivalry; Organization → Farming → Construction and Strategy → Diplomacy; Climbing → Mining → Smithery and Meditation → Philosophy; Fishing → Sailing → Navigation and Whaling → Aquatism; Hunting → Archery → Spiritualism and Forestry → Mathematics. A fourth ring adds Banking, Horsemanship, Engineering (aqueducts), Fortification (build walls), Steelworking, Medicine, Cartography, Admiralty, Husbandry (pastures) and Ballistics.
- **Units with skills:** Warrior, Rider, Archer, Defender, Swordsman, Mind Bender, Catapult, Knight and the Giant. Skills include *dash* (attack after moving), *escape* (move after attacking), *persist* (attack again after a kill, a quarter weaker each time), *fortify* (city defence bonus), *heal* and *convert*.
- **Boats:** units board at their own ports and become Boats, upgradeable at sea to Ships (Sailing) and Battleships (Navigation).
- **Cities** grow from harvests and buildings in their borders: fruit, game, fish, whales, farms, lumber huts, mines and ports, plus windmills, sawmills and forges (which grow with neighbouring industry), markets and four kinds of temple. Every level offers three rewards: workshop, explorer or militia; walls, resources or watchtower; population, border growth or barracks; park, Giant or academy.
- **Ruins** hold stars, free technology, an explorer, a veteran swordsman or new citizens.
- **Look and feel:** low-poly isometric art drawn in code. Each tribe's homeland has its own climate (meadow, autumn woods, jungle, desert, highland, tundra) with matching trees, rock, fruit and wildlife (deer, boar, tapir, camel, goat, reindeer). Land sits on earthen slabs; the sea blends from turquoise shallows to deep blue, with surf and glints. Every tribe has its own headgear and its own architecture (yurts, timber houses, stilt huts, adobe, stone keeps, igloos) that grows with city level. Objects cast soft shadows, clouds part as you explore, and snow, leaves, petals, embers, fireflies, sparkles and butterflies drift over their regions. Units walk their path tile by tile, and zoom glides. The main menu shows a living world map.
- **Shaders:** a WebGL pass adds bloom, colour grading, drifting cloud shadows and a vignette. It falls back to plain canvas when WebGL is missing, switches itself off if frames get slow, and has an on/off toggle in the Game menu.
- **Fog of war**, computer opponents that research, build, expand and use boats.
- **Three save slots**, chosen when a game starts and saved after every turn. Saved Games loads or deletes them.
- **Autosave** to the browser after every turn, sound effects with a mute toggle, mouse and touch controls.

## Rules

The rules follow *The Battle of Polytopia* as closely as possible:

- **Turns.** Each unit gets one move and one attack per turn, in that order, unless a skill changes it. New units wait a turn.
- **Capturing.** Nothing is taken on arrival. A unit that *starts* its turn on a village or enemy city can Capture it, and on ruins it can Examine them. Either uses its whole turn.
- **Roads** can be built on any land in your territory, with or without a unit on it, and on unclaimed land where your own unit stands.
- **Movement.** Forests and mountains end a move, and so does stepping next to an enemy (zone of control). Roads halve the cost between road and city tiles. Units board boats only from their own ports. Ocean needs Sailing; mountains need Climbing.
- **Combat.** Attack force = attack × health ratio; defence force = defence × health ratio × bonus; damage = round(attack share × attack × 4.5), and the defender strikes back if it survives and is in range. Bonuses: ×1.5 in cities (fortify units), forests (Archery), mountains (Climbing) and water (Aquatism), ×4 behind city walls. Melee winners advance. Knights (attack 3) lose a quarter of their damage with each Persist follow-up.
- **Healing.** A unit that has not moved or attacked can Recover: +4 health in your borders, +2 outside. Mind Benders heal neighbours. Three kills let a unit Promote to veteran with a perk of your choice (+5 max health, +1 attack, +1 defence or +1 movement), fully healed.
- **Economy.** Income is the sum of city levels, +1 for the capital, plus workshops, parks, markets and Diplomacy. Tech costs tier × number of cities + 4 (a third less with Philosophy). A city supports one unit per level, plus one; disbanding with Free Spirit refunds half.
- **Score.** Points for territory, city levels, technology, units, parks and exploration, as in Perfection mode.

Where Polytopia's exact numbers are uncertain, the closest reasonable value is used; for example, Diplomacy gives +1 star per tribe met.

## Interface

The layout follows the mobile 4X classics. Score, turn and stars sit across the top. Three round buttons along the bottom open the **Game** menu (tribe standings, sound, help), the **Tech Tree** (a radial tree around your tribe) and **End Turn**, which glows when every unit has acted.
Tapping a unit, city or tile replaces them with an info panel and round action buttons showing star costs. Cities show population pips under their name. New games start from a tribe picker and a settings screen; Pass & Play has its own player setup.

## Controls

Drag to pan, scroll or pinch to zoom. Tap a unit, then a white tile to move or a red tile to attack.
Keyboard: `E` end turn, `N` next unit, `T` technology, `Esc` close or deselect.

## Files

- `index.html`, `style.css`: page shell, menus and HUD
- `game.js`: map generation, rules, computer players, rendering and input
