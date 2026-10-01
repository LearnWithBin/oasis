import Phaser from 'phaser';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

export const SPOTS = [
  { x: 0.16, y: 0.38 }, { x: 0.26, y: 0.68 },
  { x: 0.42, y: 0.77 }, { x: 0.66, y: 0.76 },
  { x: 0.83, y: 0.62 }, { x: 0.84, y: 0.36 },
  { x: 0.12, y: 0.60 }, { x: 0.82, y: 0.20 }
];

// The persistent world uses normalized locations so scene art can be upgraded without moving saved items.
export function mountGame(host, getState, onSpot, onItem) {
  let scene;
  class OasisScene extends Phaser.Scene {
    constructor() { super('Oasis'); }
    preload() {
      this.load.image('world', asset('oasis-background.webp'));
      this.load.image('tent', asset('tent.webp'));
      this.load.image('palms', asset('date-palms.webp'));
    }
    create() { scene = this; this.paint(); }
    paint() {
      this.tweens.killAll();
      this.children.removeAll(true);
      this.add.image(768, 512, 'world').setDisplaySize(1536, 1024);
      const state = getState();
      SPOTS.forEach((spot, index) => {
        const x = spot.x * 1536, y = spot.y * 1024;
        const item = state.items.find(it => it.slot_index === index);
        if (item) {
          const key = item.item_type === 'tent' ? 'tent' : 'palms';
          const width = item.item_type === 'tent' ? 235 : 185;
          const art = this.add.image(x, y, key).setOrigin(0.5, 0.88);
          art.setDisplaySize(width, width * (art.height / art.width));
          art.setInteractive({ useHandCursor: true }).on('pointerdown', () => onItem(item));
        } else {
          const ring = this.add.ellipse(x, y, 116, 46, 0xffe3ad, 0.22).setStrokeStyle(3, 0xffffff, 0.65);
          ring.setInteractive({ useHandCursor: true }).on('pointerdown', () => onSpot(index));
          this.add.text(x, y - 7, '+', { fontSize: '32px', color: '#fff9e9', fontStyle: 'bold', stroke: '#987247', strokeThickness: 4 }).setOrigin(0.5);
        }
      });
      // Small always-visible avatar. Drawn as game graphics so skin, hair and clothes can be changed freely.
      const { skin, hair, clothes } = state.avatar;
      const color = hex => Phaser.Display.Color.HexStringToColor(hex).color;
      const a = this.add.graphics().setPosition(695, 820);
      a.fillStyle(0x744c2a, 0.22).fillEllipse(0, 0, 72, 20);
      a.fillStyle(color(clothes)).fillRoundedRect(-18, -70, 36, 49, 9);
      a.fillStyle(0x4a342b).fillRoundedRect(-16, -25, 12, 24, 3).fillRoundedRect(4, -25, 12, 24, 3);
      a.fillStyle(color(skin)).fillCircle(0, -87, 22);
      a.fillStyle(color(hair)).fillEllipse(0, -103, 45, 24);
      a.fillStyle(0x251e1a).fillCircle(-8, -85, 2).fillCircle(8, -85, 2);
      this.tweens.add({ targets: a, y: 814, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: host, width: 1536, height: 1024,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#d89c53', scene: [OasisScene],
    render: { antialias: true, pixelArt: false }
  });
  return { refresh() { scene?.paint(); }, destroy() { game.destroy(true); } };
}
