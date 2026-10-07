import { CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';

// Rings and drifting highlights sit inside the pond and scale with the camera.
export class PondWater {
  constructor(scene) {
    this.scene=scene;
    this.graphics=scene.add.graphics().setDepth(.5);
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.anchors=[ [.43,.455,0], [.55,.49,.23], [.64,.435,.46], [.58,.55,.69], [.72,.53,.84] ];
    this.update(0);
  }
  update(time) {
    const g=this.graphics;
    g.clear();
    // Keep a readable stroke even in Whole Oasis on a phone.
    const width=3/Math.max(.65,this.scene.cameras.main.zoom);
    const clock=this.reduced?.22:time/2800;
    for(const [x,y,offset] of this.anchors) {
      const phase=(clock+offset)%1, radius=15+phase*60;
      const alpha=.62*Math.sin(Math.PI*phase);
      g.lineStyle(width+1.5,0x287d8f,alpha*.5);
      g.strokeEllipse(x*W,y*H+2,radius*2,radius*.55);
      g.lineStyle(width,0xf0fffa,alpha);
      g.strokeEllipse(x*W,y*H,radius*2,radius*.55);
      g.lineStyle(width*.7,0xd2fff4,alpha*.65);
      g.strokeEllipse(x*W,y*H,radius*1.4,radius*.38);
    }
    for(let i=0;i<9;i++) {
      const drift=this.reduced?0:Math.sin(time/1100+i)*13;
      const x=(.41+i*.035)*W+drift, y=(.465+(i%3)*.025)*H;
      g.lineStyle(width*.85,0xf4fff7,.32+(this.reduced?0:.14*Math.sin(time/700+i)));
      g.beginPath();g.moveTo(x,y);g.lineTo(x+15,y-2);g.lineTo(x+33,y);g.strokePath();
    }
  }
}
