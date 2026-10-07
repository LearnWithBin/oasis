// Match the existing painted pond; the dry waterfall ledge stays accessible.
export const pondOutline = [
  [.39, .29], [.48, .27], [.59, .29], [.69, .31], [.74, .37],
  [.71, .44], [.78, .49], [.80, .54], [.75, .56], [.70, .54],
  [.68, .58], [.61, .61], [.55, .63], [.47, .60], [.39, .56],
  [.31, .51], [.29, .46], [.35, .39], [.36, .34]
];
export function insideOutline(x, y, outline) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function isDryGround(x, feetY, land = 0) {
  if (x < .06 || x > .94 || feetY < .12 || feetY > .99) return false;
  return land !== 0 || !insideOutline(x, feetY, pondOutline);
}
export function dryRoute(start, end, land = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / .015));
  for (let i = 0; i <= steps; i++) {
    if (!isDryGround(start.x + (end.x - start.x) * i / steps, start.y + (end.y - start.y) * i / steps, land)) return false;
  }
  return true;
}
