import {project,pathTo} from './navigation.js?v=2';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class GoatLife {
 constructor(pet,saved,navigation={project,pathTo}){this.nav=navigation;this.pet=!!pet;this.mode=pet?'following':saved?.mode==='returning'?'returning':'home';this.x=Number.isFinite(saved?.x)?saved.x:1245;this.y=Number.isFinite(saved?.y)?saved.y:625;this.face=1;this.route=[];this.nextPlan=0;this.moving=false;this.homeKey=null;}
 snapshot(){return{x:this.x,y:this.y,mode:this.mode};}
 reset(home){this.pet=false;this.mode='home';this.x=home.x;this.y=home.y;this.route=[];this.homeKey=null;this.moving=false;}
 gate(home){return{x:home.x-65,y:home.y+30};}
 behind(player){return this.nav.project({x:player.x-45,y:player.y+20}).point;}
 returnRoute(home,door){const gate=this.gate(home);return distance(this,home)<130?[gate,home]:[...this.nav.pathTo(this,door),gate,home];}
 setPet(pet,player,home,door){this.pet=pet;this.nextPlan=0;if(pet){this.mode=distance(this,home)<160?'joining':'following';this.route=this.mode==='joining'?[this.gate(home),door,...this.nav.pathTo(door,this.behind(player))]:this.nav.pathTo(this,this.behind(player));}else{this.mode='returning';this.route=this.returnRoute(home,door);}this.moving=this.route.length>0;}
 update(dt,time,player,home,door,pet){let arrived=false;const key=`${home.x},${home.y}`;if(pet!==this.pet)this.setPet(pet,player,home,door);if(key!==this.homeKey){if(this.homeKey&&!pet){this.mode='returning';this.route=this.returnRoute(home,door);}else if(this.mode==='home'){this.x=home.x;this.y=home.y;}else if(this.mode==='returning')this.route=this.returnRoute(home,door);this.homeKey=key;}
 if(this.mode==='following'&&time>=this.nextPlan){const target=this.behind(player);if(distance(this,target)>16)this.route=this.nav.pathTo(this,target);else if(!this.route.length)this.moving=false;this.nextPlan=time+650;}
 const target=this.route[0];this.moving=!!target;if(target){const dx=target.x-this.x,dy=target.y-this.y,d=Math.hypot(dx,dy),step=dt*210;if(Math.abs(dx)>1)this.face=dx>0?1:-1;if(d<=step){this.x=target.x;this.y=target.y;this.route.shift();if(!this.route.length){if(this.mode==='returning'){this.mode='home';arrived=true;}else if(this.mode==='joining'){this.mode='following';this.nextPlan=0;}}}else{this.x+=dx/d*step;this.y+=dy/d*step;}}
 else if(this.mode==='home'){const blend=Math.min(1,dt*3),x=home.x+Math.sin(time/3100)*12,y=home.y+Math.cos(time/2700)*4;this.face=Math.cos(time/3100)>0?1:-1;this.x+=(x-this.x)*blend;this.y+=(y-this.y)*blend;}
 return arrived;}
}
