import { worldBounds, CORE_WIDTH, CORE_HEIGHT } from './world.js';
// Match the existing painted pond; the dry waterfall ledge stays accessible.
export const pondOutline = [
  [.64,.25],[.67,.25],[.68,.29],[.63,.32],[.65,.345],[.70,.37],
  [.71,.40],[.78,.43],[.76,.46],[.77,.49],[.79,.53],[.85,.54],
  [.85,.57],[.78,.59],[.63,.61],[.525,.61],[.46,.57],[.42,.53],
  [.36,.515],[.31,.50],[.24,.49],[.24,.47],[.27,.43],[.35,.40],
  [.40,.37],[.375,.345],[.49,.33],[.51,.31],[.62,.30]
];
export function insideOutline(x, y, outline) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function isDryGround(x, feetY, level = 1) {
  const b = worldBounds(level);
  const px = x * CORE_WIDTH, py = feetY * CORE_HEIGHT;
  if (px < b.x + 64 || px > b.x + b.width - 64 || py < 123 || py > b.height - 40) return false;
  return !insideOutline(x, feetY, pondOutline);
}
export function dryRoute(start, end, level = 1, clear = () => true) {
  if(!clear(start,end))return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / .015));
  for (let i = 0; i <= steps; i++) {
    if (!isDryGround(start.x + (end.x - start.x) * i / steps, start.y + (end.y - start.y) * i / steps, level)) return false;
  }
  return true;
}

// Short routes around the pond, across both the original and newly opened ground.
export function walkingRoute(start, end, level = 1, clear = () => true) {
  if (!isDryGround(end.x, end.y, level)) return null;
  if (dryRoute(start, end, level, clear)) return [end];
  const step = 48, b = worldBounds(level);
  const point = (x,y) => ({x:x*step/CORE_WIDTH,y:y*step/CORE_HEIGHT});
  const key = (x,y) => `${x},${y}`;
  const nearest = p => {
    const x = Math.round(p.x*CORE_WIDTH/step), y = Math.round(p.y*CORE_HEIGHT/step);
    const choices = [];
    for (let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const q = point(x+dx,y+dy);
      if (dryRoute(p,q,level,clear)) choices.push({x:x+dx,y:y+dy,d:Math.hypot(q.x-p.x,q.y-p.y)});
    }
    return choices.sort((a,b)=>a.d-b.d)[0];
  };
  const first = nearest(start), last = nearest(end);
  if (!first || !last) return null;
  const finish = key(last.x,last.y);
  const open = [{...first,g:0,f:0}], scores = new Map([[key(first.x,first.y),0]]), parents = new Map(), closed = new Set();
  let found;
  while (open.length && closed.size < 5000) {
    open.sort((a,b)=>a.f-b.f);
    const node = open.shift(), id = key(node.x,node.y);
    if (closed.has(id)) continue;
    if (id === finish) {found=node;break;}
    closed.add(id);
    for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) {
      if (!dx && !dy) continue;
      const x=node.x+dx,y=node.y+dy,k=key(x,y),q=point(x,y);
      if (x*step<b.x+64 || x*step>b.x+b.width-64 || y*step<123 || y*step>b.height-40 || closed.has(k)) continue;
      if (!dryRoute(point(node.x,node.y),q,level,clear)) continue;
      const g=node.g+Math.hypot(dx,dy);
      if (g >= (scores.get(k) ?? Infinity)) continue;
      scores.set(k,g);parents.set(k,id);
      open.push({x,y,g,f:g+Math.hypot(x-last.x,y-last.y)});
    }
  }
  if (!found) return null;
  const route=[end];
  for(let id=finish;id;id=parents.get(id)) {
    const [x,y]=id.split(',').map(Number);route.unshift(point(x,y));
  }
  // Drop intermediate points when a longer straight segment stays on sand.
  const simple=[];let from=start;
  for(let i=0;i<route.length;) {
    let j=route.length-1;
    while(j>i && !dryRoute(from,route[j],level,clear)) j--;
    simple.push(route[j]);from=route[j];i=j+1;
  }
  return simple;
}
