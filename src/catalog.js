export const ITEMS = {
  cat: {label:'Cat',cost:8,refund:4,image:'cat-atlas-v1.webp',animal:{texture:'cat',step:'cat-step',walkImage:'cat-atlas-v1.webp',restImage:'cat-atlas-v1.webp',rest:'cat-rest',width:116,height:102,speed:210}},
  cat_home: {label:'Cat home',cost:12,refund:6,image:'cat-atlas-v1.webp',pen:{species:'cat',shelter:'cat-home-art',wood:0xc78385,posts:0xad686e,trim:0xf4d8cb,gate:0xce9693}},
  palms: { label: 'Date palms', cost: 2, refund: 1, image: 'date-palms.webp' },
  pen: { label: 'Goat pen', cost: 12, refund: 6, image: 'animal-pen.svg', pen: {species:'goat',shelter:'pen-shelter',wood:0xaa7947,posts:0x966333,trim:0xdbb77d,gate:0xb58a53} },
  coop: { label: 'Chicken coop', cost: 12, refund: 6, image: 'chicken-coop.svg', pen: {species:'chicken',shelter:'coop-shelter',wood:0xf5f0e5,posts:0xe9dfcc,trim:0xffffff,gate:0xf7f2e7} },
  chicken: { label: 'Chicken', cost: 6, refund: 3, image: 'chicken.svg', animal: {texture:'chicken',step:'chicken-step',walkImage:'chicken-step.svg',restImage:'chicken-rest.svg',rest:'chicken-rest',peck:'chicken-peck',peckImage:'chicken-peck.svg',width:112,height:90,speed:110} },
  tent: { label: 'Canvas tent', cost: 4, refund: 2, image: 'tent.webp' },
  goat: { label: 'Baby goat', cost: 8, refund: 4, image: 'baby-goat.svg', animal: { texture: 'goat', step: 'goat-step', walkImage: 'baby-goat-step.svg', restImage: 'baby-goat-rest.svg', rest: 'goat-rest', width: 142, height: 114, speed: 350 } }
};
export const itemLabel = type => ITEMS[type]?.label || 'Item';
export const landLevelForCount = count => Math.min(4, 1 + Math.floor((count + 2) / 8));
export const capacity = oasis => (oasis.land_level || 1) * 8;
