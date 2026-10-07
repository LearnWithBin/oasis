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

Baby goats walk, pause and hop near their saved spot, staying on dry ground.

More ground opens at 6, 14 and 22 owned items, adding eight spots each time, up to 32. Opened land stays yours after selling or trading. There are no separate land screens.

## Class trades

Open **Class trades**, or tap an item and choose **Offer to a classmate**. Ask for another item type or 1–100 stars. Both sending and accepting have review screens. Recipients choose their matching item for barter. Offers last seven days and can be declined or cancelled. Nothing transfers until acceptance. Barter works with full inventories; a star purchase requires an empty spot.

## Local development and verification

Run `npm install`, then `npm run dev`. Append `?preview=1` to use the private browser-only preview. Rebuild the published game with `npm run build:pages`.

- `node tests/world-geometry.mjs` checks 32 stable positions, connected ground, expansion limits, routes around water and waterfall access.
- `tests/goats-ui.mjs` checks preserved purchases, goat animation, camera follow, dragging, pinch zoom, expansion, reloads, refunds, waterfall access and phone/tablet layouts.
- `tests/trading-ui.mjs` checks trading screens against mocked API responses.
- `tests/trading.sql` and `tests/goats-land.sql` use temporary fixtures inside a transaction ending in `ROLLBACK`.

UI tests require Playwright through the primary runtime. Set `OASIS_BROWSER_EXECUTABLE` when using a separately installed Chromium executable.

## Artwork

`public/assets/oasis-expanded.webp` is the continuous terrain asset. It was made using built-in imagegen and optimized for browser delivery. Prompt: extend the existing illustrated Oasis into one continuous landscape with its pond and waterfall at the heart, matching golden sand, rocky palm clusters, clear building areas, a consistent elevated camera, and no buildings, animals, people or interface.

Phaser renders one terrain texture and places purchased objects over it. Item locations are saved as stable slot IDs rather than screen pixels. Vehicles and the connected class map remain future work.
