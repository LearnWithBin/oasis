# LearnWithBin Oasis

A persistent Oasis building game. Earn stars, decorate your land, customize your character, and trade items with classmates.

## One growing world

The pond, waterfall, tents, date palms and baby goats share one continuous landscape. New ground opens around the existing Oasis as you build. Saved item IDs and star balances carry forward; the original eight building positions stay in place.

- Tap sand to walk. Your character finds a dry route around the pond, and the camera follows.
- Drag the scenery to explore without moving your character or buying anything.
- Pinch, or use **+ / −**, to zoom.
- **Whole Oasis** shows the entire property; **Follow me** returns the view to your character.
- Choose an item in the build menu, then tap a glowing space to place it.
- Tap an owned item to rearrange it, sell it, or offer it in a class trade.

| Item | Buy | Sell back |
| --- | ---: | ---: |
| Date palms | 2 stars | 1 star |
| Canvas tent | 4 stars | 2 stars |
| Baby goat | 8 stars | 4 stars |
| Animal pen (six residents) | 12 stars | 6 stars |

Animals share one home area. Open **Animals** below the scene to choose one companion with **Follow me**, send it home, or move the shared home to a clear glowing spot. Existing goats gather automatically, and additional goats join the same home. They walk, rest and take dry routes around the pond. Changing companions sends the previous one walking home. Home and companion choices save across reloads. The animal menu also works when an animal is off screen.

Tap a goat for individual selling/trading and **Add another baby goat**. Visually vacated animal positions can be reused for buildings without losing animals. Animals still count toward inventory capacity and land expansion. Feeding and longer daily routines are later additions.

Buy **Animal pen**, then choose a roomy glowing spot on the same land. Select up to six owned animals in the pen menu and choose **Save animals**. Animals walk through its front gate, wander inside, and rest under the shelter. A chosen companion leaves through the gate and returns when sent home. Open **Animals → Manage pen** to change residents, or tap the pen itself. Move a pen for free; its residents walk to the new location. Selling a pen returns six stars and keeps all its animals. Pens stay on their owner’s Oasis; animals can still be traded. More pens provide homes for a larger herd.

More ground opens at 6, 14 and 22 owned items, adding eight spots each time, up to 32. Opened land stays yours after selling or trading. There are no separate land screens.

## Class trades

Open **Class trades**, or tap an item and choose **Offer to a classmate**. Ask for another item type or 1–100 stars. Both sending and accepting have review screens. Recipients choose their matching item for barter. Offers last seven days and can be declined or cancelled. Nothing transfers until acceptance. Barter works with full inventories; a star purchase requires an empty spot.

## Local development and verification

Run `npm install`, then `npm run dev`. Append `?preview=1` to use the private browser-only preview. Rebuild the published game with `npm run build:pages`.

- `node tests/world-geometry.mjs` checks 32 stable positions, connected ground, expansion limits, routes around water and waterfall access.
- `tests/goats-ui.mjs` checks preserved purchases, goat animation, camera follow, dragging, pinch zoom, expansion, reloads, refunds, waterfall access and phone/tablet layouts.
- `tests/trading-ui.mjs` checks trading screens against mocked API responses.
- `tests/pens-rules.mjs` checks dry footprints, six resident positions, fence crossings and routes through the gate.
- `tests/pens-ui.mjs` checks pen purchases, animal assignment, pet departure/return, reloads, moves, phone layout and sales.
- `tests/pens.sql` checks pen capacity, prices, ownership, overlap protection, multiple pens, transfers and sale cleanup inside a rolled-back transaction.
- `tests/trading.sql` and `tests/goats-land.sql` use temporary fixtures inside a transaction ending in `ROLLBACK`.

UI tests require Playwright through the primary runtime. Set `OASIS_BROWSER_EXECUTABLE` when using a separately installed Chromium executable.

## Artwork

`public/assets/oasis-expanded.webp` is the continuous terrain asset. It was made using built-in imagegen and optimized for browser delivery. Prompt: extend the existing illustrated Oasis into one continuous landscape with its pond and waterfall at the heart, matching golden sand, rocky palm clusters, clear building areas, a consistent elevated camera, and no buildings, animals, people or interface.

Phaser renders one terrain texture and places purchased objects over it. Item locations are saved as stable slot IDs rather than screen pixels. Vehicles and the connected class map remain future work.

`src/animals.js` and `src/animal-life.js` define shared home, herd, rest, companion and return behavior for all animal species. The item catalog supplies each species’ art, animation frames, dimensions and movement speed. New species also need their allowed type, price and pen eligibility registered in the database. `tests/animal-homes.sql` verifies ownership, grouped purchases, slot reuse, pending-trade preservation and sale/transfer cleanup in a rolled-back transaction. `tests/animals-ui.mjs` checks grouping, home changes, following around the pond, switching/dismissal, reloads, shared-home purchases and phone layout.
