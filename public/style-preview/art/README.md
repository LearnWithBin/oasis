# Approved Oasis visual direction

The playable sample at `/oasis/style-preview/` uses separate assets derived from Bin's approved Oct 8 concept. It is independent of accounts, homework stars and the main Oasis. It persists only its own arrangement and companion settings in `learnwithbin-style-preview-v1`.

All artwork was made with the built-in image generation tool using the approved concept as a visual reference, then encoded as WebP without changing its contents.

- `terrain.webp`: preserve the approved pond, waterfall, desert palette, angled camera, rocky banks, palms and connected paths. Remove UI, buildings, animal homes, animals and avatar, leaving level sandy plots. One central pond, no second foreground river.
- `objects.webp`: transparent 3 × 2 atlas. Top row: cream/terracotta tent, empty brown goat home, empty white/coral chicken home. Bottom row: cream/brown goat, white hen, date palms. Match the reference's dimensional illustrated casual-game art and camera.
- `avatar.webp`: transparent 6 × 2 atlas. Same warm-brown woman with white curls, peach/cream desert clothing, consistent human features and full body scale. First row is six walk frames; second row has three standing and three rear views. Some generated frames have similar poses, so this is an initial animation treatment for visual review.

Assets are independent images; the world is not a flattened concept screenshot. Building placement is limited to the five clear sandy plots in this first sample. Paths use a connected navigation graph; the rocky waterfall breaks the back edge, so travel between sides goes around the accessible pond front. Vehicle riding, inter-Oasis travel, avatar customization, animal leg frame sets and the production economy are outside this sample.

Verification: `node tests/style-preview-ui.mjs` with the Playwright runtime and `OASIS_BROWSER_EXECUTABLE` when needed.

## Oct 8 feedback update

- `avatar-boy-v2.webp`: matching selectable boy in ivory thobe, white headscarf and dark agal; transparent 6 × 2 atlas. The girl remains available.
- `chicken-yard-v2.webp`: standalone transparent open run with low ivory rails, a small covered nesting corner at the back and clear center space. Chickens render as independent larger sprites.
- `goat-life.js`: persistent companion position, physical joining/return routes and gradual motion. Sending home changes the goal rather than relocating the animal.
- `navigation.js`: dry branches to the left and right pond rocks and the waterfall-side ledge, with an explicit water mask.

The new artwork was generated with the built-in image tool from the approved object/avatar style. Boy prompt: matching human boy, traditional ivory Arabian outfit, consistent camera and 6 × 2 standing/walk atlas. Chicken-yard prompt: spacious low white fence, open gate, compact rear nesting cubbies, transparent floor, no house or animals baked into it.

`tests/style-preview-movement.mjs` checks dry ledge routes and continuous goat joining/return. The UI test also checks boy selection persistence, return movement and waterfall access.
