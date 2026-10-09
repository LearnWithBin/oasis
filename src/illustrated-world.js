import {nodes as originalNodes,edges as originalEdges,isWater,shorePoints} from '../public/style-preview/navigation.js';
export {isWater,shorePoints};
const nodes=originalNodes.map(p=>[...p]),edges=originalEdges.map(e=>[...e]);
// Saved slot IDs are stable. Coordinates follow the artwork, never the roads.
export const plots=[{x:340,y:190,door:[465,295]},{x:300,y:555,door:[540,635]},null,{x:1030,y:750,door:[970,680]},{x:1290,y:600,door:[1110,650]},{x:1290,y:280,door:[1170,380]},null,null];
const nativeOutlines={0:[[160,200],[350,110],[525,190],[330,275]],1:[[60,550],[295,440],[565,555],[375,665]],3:[[825,752],[1040,656],[1245,749],[1050,841]],4:[[1058,615],[1280,516],[1518,600],[1325,701]],5:[[1110,270],[1290,207],[1481,300],[1288,370]]};
const columns=[290,625,965],rowCenters=[150,420,680],rowRoads=[290,555,820];
const gridRows=9,roadNodes=[];
export const roadSegments=[];
for(let row=0;row<gridRows;row++){
 const y=900+Math.floor(row/3)*900+rowRoads[row%3],ids=[];
 for(const x of [450,780,1120]){ids.push(nodes.length);nodes.push([x,y]);}
 roadNodes.push(ids);
 for(const [x,anchor]of [[100,ids[0]],[1250,ids[2]]]){const n=nodes.length;nodes.push([x,y]);edges.push([n,anchor]);roadSegments.push([nodes[n],nodes[anchor]]);}
 for(let col=0;col<3;col++){
  if(col){edges.push([ids[col-1],ids[col]]);roadSegments.push([nodes[ids[col-1]],nodes[ids[col]]]);}
  if(row){edges.push([roadNodes[row-1][col],ids[col]]);roadSegments.push([nodes[roadNodes[row-1][col]],nodes[ids[col]]]);}
 }
}
// The existing path on the right enters the expansion's first intersection.
const entrance=nodes.length;nodes.push([1200,960]);edges.push([7,entrance],[entrance,roadNodes[0][2]]);
const expansionSlots=[6,2,7,...Array.from({length:24},(_,i)=>i+8)];
for(let n=0;n<expansionSlots.length;n++){
 const row=Math.floor(n/3),col=n%3,slot=expansionSlots[n],y=900+Math.floor(row/3)*900+rowCenters[row%3];
 plots[slot]={x:columns[col],y,door:[columns[col],nodes[roadNodes[row][col]][1]],expansion:true};
}
export function plotOutline(slot){const p=plots[slot];return nativeOutlines[slot]||[[p.x-135,p.y-95],[p.x+135,p.y-95],[p.x+135,p.y+95],[p.x-135,p.y+95]];}
export function pointInPlot(point,slot){const poly=plotOutline(slot);let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>point.y)!==(yj>point.y)&&point.x<(xj-xi)*(point.y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function buildingPosition(slot,type){const p=plots[slot];return{x:p.x,y:p.y+(type==='tent'?40:type==='palms'?35:60)};}
export const heightForLevel=level=>Math.max(1024,...plots.slice(0,Math.min(32,(level||1)*8)).map(p=>p.y+155));
export function project(p){let best={distance:Infinity};for(const [a,b] of edges){const u=nodes[a],v=nodes[b],dx=v[0]-u[0],dy=v[1]-u[1],t=Math.max(0,Math.min(1,((p.x-u[0])*dx+(p.y-u[1])*dy)/(dx*dx+dy*dy))),point={x:u[0]+dx*t,y:u[1]+dy*t},distance=Math.hypot(p.x-point.x,p.y-point.y);if(distance<best.distance)best={a,b,t,point,distance};}return best;}
export function pathTo(from,to){const s=project(from),e=project(to);if(s.a===e.a&&s.b===e.b)return[e.point];const graph=nodes.map(()=>[]);for(const[a,b]of edges){const d=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);graph[a].push([b,d]);graph[b].push([a,d]);}const dist=Array(nodes.length).fill(Infinity),parent=Array(nodes.length).fill(-1),todo=new Set(nodes.map((_,i)=>i));for(const i of[s.a,s.b])dist[i]=Math.hypot(s.point.x-nodes[i][0],s.point.y-nodes[i][1]);while(todo.size){const u=[...todo].reduce((a,b)=>dist[a]<dist[b]?a:b);todo.delete(u);for(const[v,d]of graph[u])if(dist[u]+d<dist[v]){dist[v]=dist[u]+d;parent[v]=u;}}const finish=[e.a,e.b].sort((a,b)=>(dist[a]+Math.hypot(e.point.x-nodes[a][0],e.point.y-nodes[a][1]))-(dist[b]+Math.hypot(e.point.x-nodes[b][0],e.point.y-nodes[b][1])))[0];const result=[e.point];for(let n=finish;n!==-1;n=parent[n])result.unshift({x:nodes[n][0],y:nodes[n][1]});return result;}

export function buildSlots(oasis,intent,{penLocationAvailable,buildingClearOfPens,isPen,isAnimal,animalHomeSlot}){const animal=isAnimal(intent.item);return plots.slice(0,(oasis.land_level||1)*8).map((p,index)=>({index,...p})).filter(p=>{
 if(intent.type==='move'&&!intent.id)return false;
 if(intent.type==='animal-home')return !oasis.items.some(i=>i.slot_index===p.index&&!isAnimal(i.item_type));
 if(isPen(intent.item))return penLocationAvailable(oasis,p.index,intent.id);
 if(!animal&&!buildingClearOfPens(oasis,p.index,intent.id))return false;
 if(!animal&&p.index===animalHomeSlot(oasis))return false;
 return !oasis.items.some(i=>i.slot_index===p.index&&i.id!==intent.id&&!isAnimal(i.item_type));
 });}
