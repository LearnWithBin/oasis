import Phaser from 'phaser';
import { walkingRoute } from './ground.js';
import { ITEMS } from './catalog.js';
import { isAnimal, animalHomeSlot, ownedAnimals } from './animals.js';
import { AnimalLife } from './animal-life.js';
import { CORE_WIDTH as W, CORE_HEIGHT as H, WORLD_SPOTS, worldBounds } from './world.js';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

export function mountGame(host, getState, onSpot, onItem, onWalk, onProjection) {
  let scene, pendingPosition = {x:.45,y:.85};
  const blocked = () => !!document.querySelector('.scrim');
  class OasisScene extends Phaser.Scene {
    constructor() { super('Oasis'); }
    preload() {
      this.load.image('expanded-world', asset('oasis-expanded.webp'));
      this.load.image('tent', asset('tent.webp'));
      this.load.image('palms', asset('date-palms.webp'));
      Object.values(ITEMS).filter(item=>item.animal).forEach(item=>{
        const config=item.animal;
        [[config.texture,item.image],[config.step,config.walkImage],[config.rest,config.restImage]].forEach(([key,file])=>{
          if(file.endsWith('.svg'))this.load.svg(key,asset(file),{width:240,height:192});
          else this.load.image(key,asset(file));
        });
      });
    }
    create() {
      scene = this;
      this.player = {x:pendingPosition.x*W,y:pendingPosition.y*H};
      this.center = {x:W/2,y:H/2};
      this.follow = false;
      Object.entries(ITEMS).filter(([,item])=>item.animal).forEach(([type,item])=>this.anims.create({key:`${type}-walk`,frames:[{key:item.animal.texture},{key:item.animal.step}],frameRate:6,repeat:-1}));
      this.life=new AnimalLife(this,onItem);
      this.trail=[{...this.player}];
      // One continuous illustrated terrain. Preserve a roomy foreground while
      // keeping the pond aligned with the existing saved building locations.
      const source=this.textures.get('expanded-world').getSourceImage();
      const terrain=this.textures.createCanvas('terrain',W*2,H*2);
      const split=source.height*700/1024;
      terrain.context.drawImage(source,0,0,source.width,split,0,0,W*2,H);
      terrain.context.drawImage(source,0,split,source.width,source.height-split,0,H,W*2,H);
      terrain.refresh();
      this.input.addPointer(1);
      this.input.on('pointerdown',pointer=>{
        if(blocked())return;
        this.press={x:pointer.x,y:pointer.y,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY,dragged:false,target:this.hitTarget};
        this.hitTarget=null;
        if(this.activeTouches().length===2) {this.pinchDistance=this.touchDistance();this.pinchZoom=this.cameras.main.zoom;this.press.dragged=true;}
      });
      this.input.on('pointermove',pointer=>{
        if(blocked()||!this.press||!pointer.isDown)return;
        if(this.activeTouches().length===2){
          this.follow=false;this.press.dragged=true;
          if(!this.pinchDistance){this.pinchDistance=this.touchDistance();this.pinchZoom=this.cameras.main.zoom;}
          this.zoomTo(this.pinchZoom*this.touchDistance()/this.pinchDistance);return;
        }
        const dx=pointer.x-this.press.x,dy=pointer.y-this.press.y;
        if(Math.hypot(dx,dy)>12)this.press.dragged=true;
        if(!this.press.dragged)return;
        this.follow=false;
        const cam=this.cameras.main;
        this.center={x:this.press.scrollX+W/2-dx/cam.zoom,y:this.press.scrollY+H/2-dy/cam.zoom};
        this.applyCamera();
      });
      this.input.on('pointerup',pointer=>{
        const press=this.press;this.press=null;this.pinchDistance=null;this.hitTarget=null;
        if(blocked()||!press||press.dragged)return;
        if(press.target)return press.target();
        const p=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        onWalk(p.x/W,p.y/H-.08);
      });
      this.input.on('wheel',(_pointer,_objects,_dx,dy)=>{if(!blocked())this.zoomTo(this.cameras.main.zoom*(dy>0?.9:1.1));});
      this.game.canvas.addEventListener('wheel',event=>event.preventDefault(),{passive:false});
      this.paint();this.overview();
    }
    activeTouches(){return this.input.manager.pointers.filter(p=>p.isDown&&p.wasTouch);}
    touchDistance(){const [a,b]=this.activeTouches();return a&&b?Phaser.Math.Distance.Between(a.x,a.y,b.x,b.y):1;}
    target(object,callback){
      object.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(!blocked())this.hitTarget=callback;});
    }
    paint() {
      // Capture current animal positions before rebuilding sprites. A companion
      // change or home move must send animals walking, rather than teleporting.
      for(const node of this.life.nodes)this.life.positions.set(node.item.id,{x:node.view.x/W,y:node.view.y/H});
      this.life.nodes=[];
      this.children.removeAll(true);
      const state=getState(),level=state.land_level||1;
      this.bounds=worldBounds(level);
      this.add.image(W/2,H,'terrain');
      const homeSlot=animalHomeSlot(state);
      WORLD_SPOTS.slice(0,level*8).forEach((spot,index)=>{
        const x=spot.x*W,y=spot.y*H;
        const item=state.items.find(it=>it.slot_index===index);
        if(index===homeSlot){
          const marker=this.add.ellipse(x,y+40,300,145,0xf8e5b6,.17).setStrokeStyle(3,0xffefc8,.8).setDepth(y-120);
          this.target(marker,()=>onSpot(index));
          this.add.text(x,y+115,`Animal home · ${ownedAnimals(state).length}`,{fontSize:'24px',fontStyle:'bold',color:'#fff8df',stroke:'#705333',strokeThickness:4}).setOrigin(.5).setDepth(y+115);
          return;
        }
        if(item&&!isAnimal(item.item_type)){
          const width=item.item_type==='tent'?235:185;
          const art=this.add.image(x,y,item.item_type).setOrigin(.5,.88);
          art.setDisplaySize(width,width*art.height/art.width).setDepth(y);
          this.target(art,()=>onItem(item));
        } else {
          const ring=this.add.ellipse(x,y,116,46,0xffe3ad,.25).setStrokeStyle(3,0xffffff,.8).setDepth(y);
          this.target(ring,()=>onSpot(index));
          this.add.text(x,y-7,'+',{fontSize:'32px',color:'#fff9e9',fontStyle:'bold',stroke:'#987247',strokeThickness:4}).setOrigin(.5).setDepth(y+1);
        }
      });
      this.life.rebuild(state);
      // A soft boundary shows the edge of your property without dividing the world.
      if(level>1){
        const b=this.bounds;
        this.add.rectangle(b.x+b.width/2,b.height/2,b.width-35,b.height-35).setStrokeStyle(3,0xffedc2,.45).setDepth(1);
      }
      if(this.cameras.main.zoom<this.minZoom())this.overview();
      this.applyCamera();
    }
    minZoom(){const b=this.bounds||worldBounds(1);return Math.max(W/b.width,H/b.height);}
    zoomTo(zoom){this.cameras.main.setZoom(Phaser.Math.Clamp(zoom,this.minZoom(),1.6));this.applyCamera();}
    overview(){const b=this.bounds;this.follow=false;this.center={x:b.x+b.width/2,y:b.height/2};this.cameras.main.setZoom(this.minZoom());this.applyCamera();}
    followPlayer(){this.follow=true;this.zoomTo(Math.max(.95,this.cameras.main.zoom));this.center={...this.player};this.applyCamera();}
    applyCamera(){
      const cam=this.cameras.main,b=this.bounds;if(!b)return;
      const halfW=W/cam.zoom/2,halfH=H/cam.zoom/2;
      const clamp=(value,min,max)=>min>max?(min+max)/2:Phaser.Math.Clamp(value,min,max);
      this.center.x=clamp(this.center.x,b.x+halfW,b.x+b.width-halfW);
      this.center.y=clamp(this.center.y,halfH,b.height-halfH);
      cam.centerOn(this.center.x,this.center.y);
    }
    walkTo(x,y){
      const end={x,y:y+.08},start={x:this.player.x/W,y:this.player.y/H};
      const route=walkingRoute(start,end,getState().land_level||1);
      if(!route)return false;
      this.walkTween?.stop();this.follow=true;
      this.zoomTo(Math.max(.95,this.cameras.main.zoom));
      let index=0;
      const next=()=>{
        const point=route[index++];
        if(!point){this.isWalking=false;return;}
        this.facingLeft=point.x*W<this.player.x;this.isWalking=true;
        const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,point.x*W,point.y*H);
        this.walkTween=this.tweens.add({targets:this.player,x:point.x*W,y:point.y*H,duration:Math.max(100,distance/300*1000),ease:'Linear',onComplete:next});
      };
      next();return true;
    }
    update(time,delta){
      if(!this.player||!this.bounds)return;
      if(this.follow){this.center.x=Phaser.Math.Linear(this.center.x,this.player.x,.12);this.center.y=Phaser.Math.Linear(this.center.y,this.player.y,.12);this.applyCamera();}
      const last=this.trail.at(-1);
      if(Math.hypot(this.player.x-last.x,this.player.y-last.y)>18){this.trail.push({...this.player});if(this.trail.length>200)this.trail.shift();}
      this.life.update(time,delta,this.player,this.trail);
      const cam=this.cameras.main;
      // DOM character uses the same camera projection as every Phaser object.
      const x=W/2+(this.player.x-this.center.x)*cam.zoom;
      const y=H/2+(this.player.y-this.center.y-85)*cam.zoom;
      onProjection({x:x/W,y:y/H,height:170*cam.zoom/H,walking:!!this.isWalking,facingLeft:!!this.facingLeft,worldX:this.player.x/W,worldY:this.player.y/H-.08,zoom:cam.zoom});
    }
  }
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host,width:W,height:H,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},backgroundColor:'#d89c53',scene:[OasisScene],render:{antialias:true,pixelArt:false}});
  return {
    refresh(){scene?.paint();},
    walkTo(x,y){return scene?.walkTo(x,y)??false;},
    overview(){scene?.overview();},
    follow(){scene?.followPlayer();},
    zoom(direction){if(scene)scene.zoomTo(scene.cameras.main.zoom*(direction>0?1.2:1/1.2));},
    setPosition(x,y){pendingPosition={x,y:y+.08};if(scene){scene.walkTween?.stop();scene.isWalking=false;scene.player={x:x*W,y:(y+.08)*H};scene.followPlayer();}},
    destroy(){game.destroy(true);}
  };
}
