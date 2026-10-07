import Phaser from 'phaser';
import { dryRoute } from './ground.js';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

// The original eight locations never change. Additional areas use new slot IDs.
export const SPOTS = [
  { x: 0.16, y: 0.38 }, { x: 0.26, y: 0.68 },
  { x: 0.42, y: 0.77 }, { x: 0.66, y: 0.76 },
  { x: 0.83, y: 0.62 }, { x: 0.84, y: 0.36 },
  { x: 0.12, y: 0.60 }, { x: 0.82, y: 0.20 }
];
export const DUNE_SPOTS = [
  { x: .18, y: .32 }, { x: .42, y: .36 }, { x: .67, y: .31 }, { x: .85, y: .43 },
  { x: .17, y: .68 }, { x: .38, y: .77 }, { x: .62, y: .69 }, { x: .83, y: .78 }
];

export function mountGame(host, getState, onSpot, onItem, onWalk) {
  let scene, land = 0;
  class OasisScene extends Phaser.Scene {
    constructor() { super('Oasis'); }
    preload() {
      this.load.image('world', asset('oasis-background.webp'));
      this.load.image('tent', asset('tent.webp'));
      this.load.image('palms', asset('date-palms.webp'));
      this.load.svg('goat', asset('baby-goat.svg'), { width: 240, height: 192 });
      this.load.svg('goat-step', asset('baby-goat-step.svg'), { width: 240, height: 192 });
      this.load.svg('dunes', asset('oasis-dunes.svg'), { width: 1536, height: 1024 });
    }
    create() {
      scene = this;
      this.anims.create({ key: 'goat-walk', frames: [{ key: 'goat' }, { key: 'goat-step' }], frameRate: 6, repeat: -1 });
      this.input.on('pointerdown', pointer => onWalk(pointer.worldX / 1536, pointer.worldY / 1024));
      this.paint();
    }
    paint() {
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.children.removeAll(true);
      this.add.image(768, 512, land === 0 ? 'world' : 'dunes').setDisplaySize(1536, 1024);
      const state = getState();
      (land === 0 ? SPOTS : DUNE_SPOTS).forEach((spot, localIndex) => {
        const index = land * 8 + localIndex;
        const x = spot.x * 1536, y = spot.y * 1024;
        const item = state.items.find(it => it.slot_index === index);
        if (item?.item_type === 'goat') return this.addGoat(item, x, y);
        if (item) {
          const key = item.item_type === 'tent' ? 'tent' : 'palms';
          const width = item.item_type === 'tent' ? 235 : 185;
          const art = this.add.image(x, y, key).setOrigin(0.5, 0.88);
          art.setDisplaySize(width, width * (art.height / art.width));
          art.setInteractive({ useHandCursor: true }).on('pointerdown', (_pointer, _x, _y, event) => {
            event.stopPropagation(); onItem(item);
          });
        } else {
          const ring = this.add.ellipse(x, y, 116, 46, 0xffe3ad, 0.22).setStrokeStyle(3, 0xffffff, 0.65);
          ring.setInteractive({ useHandCursor: true }).on('pointerdown', (_pointer, _x, _y, event) => {
            event.stopPropagation(); onSpot(index);
          });
          this.add.text(x, y - 7, '+', { fontSize: '32px', color: '#fff9e9', fontStyle: 'bold', stroke: '#987247', strokeThickness: 4 }).setOrigin(0.5);
        }
      });
    }
    addGoat(item, x, y) {
      const shadow = this.add.ellipse(0, 0, 70, 15, 0x674b32, .22);
      const goat = this.add.sprite(0, 0, 'goat').setOrigin(.5, .92).setDisplaySize(126, 101);
      const animal = this.add.container(x, y, [shadow, goat]).setName(`goat:${item.id}`).setSize(150, 125);
      goat.setInteractive({ useHandCursor: true }).on('pointerdown', (_pointer, _x, _y, event) => {
        event.stopPropagation(); onItem(item);
      });
      const wander = () => {
        if (!animal.active) return;
        const start = { x: animal.x / 1536, y: animal.y / 1024 };
        let target;
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = { x: x / 1536 + Phaser.Math.FloatBetween(-.085, .085), y: y / 1024 + Phaser.Math.FloatBetween(-.055, .055) };
          if (dryRoute(start, candidate, land)) { target = candidate; break; }
        }
        if (!target) { this.time.delayedCall(1800, wander); return; }
        goat.setFlipX(target.x < start.x);
        goat.play('goat-walk');
        const travel = Math.max(900, Math.hypot(target.x - start.x, target.y - start.y) * 16000);
        this.tweens.add({ targets: animal, x: target.x * 1536, y: target.y * 1024, duration: travel, ease: 'Sine.easeInOut', onComplete: () => {
          goat.stop().setTexture('goat');
          // A quick happy hop between walks. The shadow stays on the sand.
          this.tweens.add({ targets: goat, y: -28, duration: 230, ease: 'Sine.easeOut', yoyo: true });
          this.time.delayedCall(Phaser.Math.Between(1600, 3500), wander);
        } });
      };
      this.time.delayedCall(Phaser.Math.Between(350, 1400), wander);
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: host, width: 1536, height: 1024,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#d89c53', scene: [OasisScene],
    render: { antialias: true, pixelArt: false }
  });
  return { setLand(index) { land = index; }, refresh() { scene?.paint(); }, destroy() { game.destroy(true); } };
}
