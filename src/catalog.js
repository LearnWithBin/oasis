export const ITEMS = {
  palms: { label: 'Date palms', cost: 2, refund: 1, image: 'date-palms.webp' },
  tent: { label: 'Canvas tent', cost: 4, refund: 2, image: 'tent.webp' },
  goat: { label: 'Baby goat', cost: 8, refund: 4, image: 'baby-goat.svg' }
};
export const itemLabel = type => ITEMS[type]?.label || 'Item';
export const landLevelForCount = count => Math.min(4, 1 + Math.floor((count + 2) / 8));
export const capacity = oasis => (oasis.land_level || 1) * 8;
