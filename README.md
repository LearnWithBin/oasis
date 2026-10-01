# LearnWithBin Oasis

Permanent Phaser game foundation for Sister Bin’s class. The first release includes a fixed-angle oasis scene, named persistent personal worlds, customizable always-visible avatars, six welcome stars, and purchasable/rearrangeable tents and date palms. One source tree supports the private preview and the connected student game.

## Run the private preview

`npm install` then `npm run dev`. Open the local address with `?preview=1`. The preview saves to that browser only; it is **not** a student account or the production database.

## Connect the real student game

1. The existing `LearnWithBin-Oasis` Supabase project has anonymous sign-ins enabled. The initial, private-functions, and server-grants migrations are applied.
2. The `redeem-invite` Edge Function is already deployed. Keep its service role key on the server only; never put it in Vite variables or GitHub source. Supabase provides the URL, anon key and service role key to Edge Functions.
3. The first host is GitHub Pages at `https://learnwithbin.github.io/oasis/`. The public repository is named `oasis`. The checked-in `docs/` folder is the published game; source files remain in the same repository for permanent development. Set Pages source to **Deploy from a branch**, branch **main**, folder **/docs**. Use `npm run build:pages` after changes to rebuild the published folder. The working local copy has `.env` configured, but that file is intentionally excluded from the repository and archive. A publishable key is safe to ship in browser code; never add a service role key.
4. Five student links and one separate teacher Test link have been created and saved outside this public repository. Do not rerun `supabase/create-student-links.sql` for this class. The teacher Test Oasis is in its own class. Send each child only their private link when the teacher is ready. The link is a bearer credential; anyone holding it can take over that Oasis, so share privately with parents. Opening it on another device reassigns access to the latest device.

The current database stores `class_id`, so a new cohort can be created without mixing its oases or future trades. It deliberately records no child names. Oasis names and avatar colors are chosen by students. SQL functions enforce prices, balance, ownership, and slot constraints; direct client edits to stars are denied. The `award_stars` function is reserved for a trusted, idempotent score importer after Base44 results and identity mapping have been verified. **Automatic LearnWithBin stars, historical points, trading, vehicles, expansion, and class map are not built yet.**

## Agreed star conversion

For a completed educational game, award `10 + round(10 × score ÷ maximum_score)` stars, capped at 10–20. Thus 150/190 and 4/5 each earn 18 stars. This normalizes games with different raw point totals and lets a student buy several current items per activity (tent: 4, palms: 2). The importer must use the actual maximum score for each activity, confirm completion, match known name variants to the correct student, and use the source result's unique ID for idempotency. Base44 historical records shown so far were created by Anonymous, so typed names alone are not proof of student identity. Teacher “Test” results belong only to the separate Test Oasis. Other adults who played for fun are not students and must not receive student awards.

For replays of the same activity, use the best completed score. An improvement awards only the difference in stars (for example, 18 then 19 means one additional star), preventing repeated full awards.

The Supabase `award_game_result` RPC implements this conversion and replay rule for a trusted server only. It records source result IDs to prevent duplicates. A rollback test verified 150/190 → 18, repeated import → 0, improved result → 1 extra, and 4/5 in a different game → 18. The Base44 importer and verified student identity mapping are **not connected yet**, so this database function does not award stars from homework on its own.

## Agreed trading behavior (future release)

Trades are asynchronous and limited to members of the same student class. A student may propose either an item-for-item barter or an item sale for stars. The recipient accepts or declines when they next open Oasis. Transfer the item(s) and/or stars together only on acceptance, after checking current ownership and balance; expired, declined, or invalid offers move nothing. The teacher Test Oasis belongs to a separate class and cannot trade with students. The current game does not yet have trading, inventory, dates, or vehicles.

A temporary test Oasis used in development was removed after an end-to-end check of sign-in, private-link redemption, saving an avatar/name, buying, moving, balance, and separation between student accounts. Five student Oases and the separate teacher Test Oasis have six welcome stars each.

Generated artwork in `public/assets` is project art. `oasis-background.webp` is 1536×1024 and game placements are stored as slot numbers independent of pixels, so improving art later does not move saved items.
