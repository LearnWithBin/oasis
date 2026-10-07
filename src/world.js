// Stable saved slot IDs now map into one landscape. The original eight stay put.
export const CORE_WIDTH = 1536;
export const CORE_HEIGHT = 1024;
export const WORLD_SPOTS = [
  [.16,.38],[.26,.68],[.42,.77],[.66,.76],[.83,.62],[.84,.36],[.12,.60],[.82,.20],
  [.35,1.18],[.56,1.07],[.87,1.37],[1.12,.35],[1.08,.63],[-.15,.37],[-.13,.65],[.68,1.34],
  [-.25,1.18],[-.24,.62],[-.22,.22],[1.24,.30],[1.23,.65],[1.18,1.35],[.66,1.52],[.23,1.53],
  [-.38,1.62],[-.40,1.00],[-.40,.42],[1.40,.42],[1.40,.95],[1.30,1.75],[.80,1.80],[.26,1.80]
].map(([x,y]) => ({x,y}));
export function worldBounds(level = 1) {
  const bounds = [
    {x:0,y:0,width:1536,height:1024},
    {x:-384,y:0,width:2304,height:1536},
    {x:-576,y:0,width:2688,height:1792},
    {x:-768,y:0,width:3072,height:2048}
  ];
  return bounds[Math.max(0,Math.min(3,level-1))];
}
