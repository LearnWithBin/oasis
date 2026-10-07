import { animalPen, penResidents, penPosition, insidePen, fenceClear } from './pens.js';
import { ITEMS } from './catalog.js';
import { ownedAnimals, herdPosition, companionTarget } from './animals.js';
import { isDryGround, dryRoute, walkingRoute } from './ground.js';
import { CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';

export class AnimalLife {
  constructor(scene,onItem){this.scene=scene;this.onItem=onItem;this.positions=new Map();this.nodes=[];}
  rebuild(state){
    for(const node of this.nodes)this.positions.set(node.item.id,{x:node.view.x/W,y:node.view.y/H});
    this.nodes=[];this.state=state;
    const animals=ownedAnimals(state);
    for(const id of this.positions.keys())if(!animals.some(item=>item.id===id))this.positions.delete(id);
    animals.forEach((item,index)=>{
      const pen=animalPen(state,item),config={...ITEMS[item.item_type].animal},home=herdPosition(state,index);
      if(pen){config.width=105;config.height=84;}
      const saved=this.positions.get(item.id),position=saved&&isDryGround(saved.x,saved.y,state.land_level||1)?saved:home;
      const shadow=this.scene.add.ellipse(0,0,70,15,0x674b32,.22);
      const art=this.scene.add.sprite(0,0,config.texture).setOrigin(.5,.92).setDisplaySize(config.width,config.height);
      const sleep=this.scene.add.text(42,-100,'z z',{fontFamily:'Georgia',fontStyle:'bold',fontSize:'23px',color:'#fff9e9',stroke:'#78583a',strokeThickness:3}).setVisible(false);
      const view=this.scene.add.container(position.x*W,position.y*H,[shadow,art,sleep]).setName(`animal:${item.id}`).setDepth(position.y*H);
      this.scene.target(art,()=>this.onItem(item));
      const node={item,config,pen,home,view,art,sleep,route:[],mode:'idle',nextDecision:this.scene.time.now+700,replanAt:0,hopUntil:0};
      this.nodes.push(node);
    });
  }
  routeTo(node,point){
    const route=walkingRoute({x:node.view.x/W,y:node.view.y/H},{x:point.x/W,y:point.y/H},this.state.land_level||1,(a,b)=>fenceClear(a,b,this.state));
    node.route=route?.map(p=>({x:p.x*W,y:p.y*H}))||[];
  }
  update(time,delta,leader,trail){
    for(const node of this.nodes){
      const {view,art,config,home}=node;
      const pet=this.state.companion_item_id===node.item.id;
      let goal=pet?companionTarget(trail,leader):{x:home.x*W,y:home.y*H};
      if(pet&&!isDryGround(goal.x/W,goal.y/H,this.state.land_level||1))goal=leader;
      const distance=Math.hypot(goal.x-view.x,goal.y-view.y);
      if(pet){
        node.restOnArrival=false;
        node.sleep.setVisible(false);
        if(time>node.replanAt && distance>65){this.routeTo(node,goal);node.replanAt=time+550;node.mode='following';}
      } else if((node.pen?!insidePen({x:view.x/W,y:view.y/H},node.pen,30):distance>105) && time>node.replanAt){
        this.routeTo(node,goal);node.replanAt=time+1000;node.mode='returning';node.sleep.setVisible(false);
      } else if(!node.route.length && time>node.nextDecision){
        if(node.mode==='resting'){node.mode='idle';node.nextDecision=time+1000;}
        else if(Math.random()<.38){
          if(node.pen){const residents=penResidents(this.state,node.pen),bed=penPosition(node.pen,residents.findIndex(i=>i.id===node.item.id),true);this.routeTo(node,{x:bed.x*W,y:bed.y*H});node.restOnArrival=true;}
          node.mode='resting';node.nextDecision=time+3500+Math.random()*3500;
        }
        else {
          for(let attempt=0;attempt<8;attempt++){
            const target={x:home.x+(Math.random()-.5)*.035,y:home.y+(Math.random()-.5)*.035};
            if(node.pen&&!insidePen(target,node.pen,40))continue;
            if(dryRoute({x:view.x/W,y:view.y/H},target,this.state.land_level||1,(a,b)=>fenceClear(a,b,this.state))){
              node.route=[{x:target.x*W,y:target.y*H}];node.mode='roaming';break;
            }
          }
          node.nextDecision=time+2200;
        }
      }
      const target=node.route[0];
      if(target){
        node.sleep.setVisible(false);
        art.setDisplaySize(config.width,config.height).setFlipX(target.x<view.x);
        if(!art.anims.isPlaying)art.play(`${node.item.item_type}-walk`);
        const dx=target.x-view.x,dy=target.y-view.y,length=Math.hypot(dx,dy),step=config.speed*Math.min(delta,50)/1000;
        if(length<=step){
          view.setPosition(target.x,target.y);node.route.shift();
          if(!node.route.length){
            art.stop().setTexture(config.texture);
            node.nextDecision=time+1700+Math.random()*2200;
            if(!pet&&Math.random()<.25)node.hopUntil=time+440;
            node.mode=node.restOnArrival&&!pet?'resting':'idle';node.restOnArrival=false;
          }
        } else view.setPosition(view.x+dx/length*step,view.y+dy/length*step);
      } else {
        art.stop().setTexture(node.mode==='resting'?config.rest:config.texture);
        art.setDisplaySize(config.width,config.height*(node.mode==='resting'?.84:1));
        node.sleep.setVisible(node.mode==='resting');
      }
      art.y=node.hopUntil>time?-Math.sin((node.hopUntil-time)/440*Math.PI)*22:0;
      view.setDepth(view.y);
    }
    if(time>(this.reportAt||0)){
      this.scene.game.canvas.dataset.animals=JSON.stringify(this.nodes.map(n=>({id:n.item.id,x:n.view.x/W,y:n.view.y/H,mode:n.mode})));
      this.reportAt=time+100;
    }
  }
}
