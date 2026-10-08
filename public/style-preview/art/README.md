# Approved Oasis visual direction

The playable sample at `/oasis/style-preview/` uses separate assets derived from Bin's approved Oct 8 concept. It is independent of accounts, homework stars and the main Oasis. It persists only its own arrangement and companion settings in `learnwithbin-style-preview-v1`.

All artwork was made with the built-in image generation tool using the approved concept as a visual reference, then encoded as WebP without changing its contents.

- `terrain.webp`: preserve the approved pond, waterfall, desert palette, angled camera, rocky banks, palms and connected paths. Remove UI, buildings, animal homes, animals and avatar, leaving level sandy plots. One central pond, no second foreground river.
- `objects.webp`: transparent 3 × 2 atlas. Top row: cream/terracotta tent, empty brown goat home, empty white/coral chicken home. Bottom row: cream/brown goat, white hen, date palms. Match the reference's dimensional illustrated casual-game art and camera.
- `avatar.webp`: transparent 6 × 2 atlas. Same warm-brown woman with white curls, peach/cream desert clothing, consistent human features and full body scale. First row is six walk frames; second row has three standing and three rear views. Some generated frames have similar poses, so this is an initial animation treatment for visual review.

Assets are independent images; the world is not a flattened concept screenshot. Building placement is limited to the five clear sandy plots in this first sample. Paths use a connected navigation graph; the rocky waterfall breaks the back edge, so travel between sides goes around the accessible pond front. Vehicle riding, inter-Oasis travel, avatar customization, animal leg frame sets and the production economy are outside this sample.

Verification: `node tests/style-preview-ui.mjs` with the Playwright runtime and `OASIS_BROWSER_EXECUTABLE` when needed.
