import { WORLD_SPOTS, CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';
import { penGate } from './pens.js';
export function drawPen(scene,pen,count,onTap){
 const c=WORLD_SPOTS[pen.slot_index],x=c.x*W,y=c.y*H;
 const ground=scene.add.ellipse(x,y+12,370,230,0xcba36a,.30).setStrokeStyle(3,0xeed5a2,.6).setDepth(y-180);scene.target(ground,onTap);
 const back=scene.add.graphics().setPosition(x,y).setDepth(y-125);
 const front=scene.add.graphics().setPosition(x,y).setDepth(y+120);
 const fence=(g,ax,ay,bx,by)=>{
  g.lineStyle(9,0x674728,.45);g.lineBetween(ax+4,ay-7,bx+4,by-7);
  for(const lift of [12,35]){g.lineStyle(7,0xaa7947,1);g.lineBetween(ax,ay-lift,bx,by-lift);g.lineStyle(2,0xdbb77d,1);g.lineBetween(ax,ay-lift-2,bx,by-lift-2);}
  const n=Math.ceil(Math.hypot(bx-ax,by-ay)/65);
  for(let i=0;i<=n;i++){const px=ax+(bx-ax)*i/n,py=ay+(by-ay)*i/n;g.fillStyle(0x966333,1);g.fillRoundedRect(px-5,py-52,10,56,2);g.fillStyle(0xd6ab70,1);g.fillRect(px-4,py-51,3,52);}
 };
 fence(back,-180,-120,180,-120);fence(front,-180,-120,-180,120);fence(front,180,-120,180,120);fence(front,-180,120,-46,120);fence(front,46,120,180,120);
 const shelter=scene.add.image(x,y-10,'pen-shelter').setOrigin(.5,.9).setDisplaySize(218,164).setDepth(y-8);scene.target(shelter,onTap);
 // Gate swings aside when the player or any animal approaches the opening.
 const gate=scene.add.graphics().setPosition(x-46,y+120).setDepth(y+121);
 gate.lineStyle(6,0xb58a53,1);gate.strokeRect(0,-40,92,32);gate.lineBetween(0,-40,92,-8);gate.fillStyle(0xe7c486,1);gate.fillCircle(80,-26,4);
 const label=scene.add.text(x,y+160,`Animal pen · ${count}/6`,{fontSize:'23px',fontStyle:'bold',color:'#fff8df',stroke:'#705333',strokeThickness:4}).setOrigin(.5).setDepth(y+165);scene.target(label,onTap);
 return{update(player,animals){const p=penGate(pen),near=q=>Math.hypot(q.x-p.x*W,q.y-p.y*H)<110;const open=near(player)||animals.some(n=>near(n.view));gate.setScale(open?.16:1);gate.setRotation(open?-.65:0);}};
}
