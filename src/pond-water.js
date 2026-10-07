import { CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';

// Small, slow rings stay inside the open water, clear of the illustrated banks.
// One reusable graphics object follows the scene's camera and rebuild lifecycle.
export class PondWater {
  constructor(scene) {
    this.graphics=scene.add.graphics().setDepth(.5);
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.anchors=[ [.48,.455,0], [.57,.49,.32], [.64,.435,.65], [.55,.55,.83] ];
    this.update(0);
  }
  update(time) {
    const g=this.graphics;
    g.clear();
    const clock=this.reduced?0:time/6500;
    for(const [x,y,offset] of this.anchors) {
      const phase=(clock+offset)%1;
      const radius=10+phase*40;
      const alpha=.2*Math.sin(Math.PI*phase);
      g.lineStyle(1.6,0xd8fff5,alpha);
      g.strokeEllipse(x*W,y*H,radius*2,radius*.55);
      g.lineStyle(1,0x66cbbf,alpha*.6);
      g.strokeEllipse(x*W,y*H+3,radius*2+6,radius*.55+3);
    }
    // Low glints drift a few pixels rather than covering the painted water.
    for(let i=0;i<6;i++) {
      const drift=this.reduced?0:Math.sin(time/2300+i)*5;
      const x=(.44+i*.033)*W+drift, y=(.47+(i%3)*.022)*H;
      g.lineStyle(1.5,0xe6fff3,.10+(this.reduced?0:.06*Math.sin(time/1800+i)));
      g.beginPath();g.moveTo(x,y);g.lineTo(x+12,y-1);g.lineTo(x+24,y);g.strokePath();
    }
  }
}
