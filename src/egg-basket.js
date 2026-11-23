// A close-up of the saved eggs. Large inventories use a sample plus an exact count.
export function basketPicture(count) {
  const eggs = Math.min(6, Math.max(0, Math.floor(Number(count) || 0)));
  const positions = [[87, 81], [127, 81], [61, 96], [105, 100], [151, 96], [111, 60]];
  return `<svg class="basket-picture" viewBox="0 0 220 190" role="img" aria-label="${count} ${count === 1 ? 'egg' : 'eggs'} in your basket">
    <ellipse cx="110" cy="168" rx="76" ry="10" fill="#9e784b22"/>
    <path d="M57 116C46 13 174 13 163 116" fill="none" stroke="#77502f" stroke-width="12"/>
    <path d="M57 116C46 13 174 13 163 116" fill="none" stroke="#dab57b" stroke-width="5"/>
    <path d="M36 112Q110 77 184 112L165 156Q110 178 55 156Z" fill="#906134"/>
    ${positions.slice(0, eggs).map(([x, y], i) => `<path data-basket-egg d="M${x} ${y - 22}C${x - 12} ${y - 22} ${x - 20} ${y} ${x - 17} ${y + 12}C${x - 13} ${y + 30} ${x + 15} ${y + 30} ${x + 18} ${y + 11}C${x + 20} ${y} ${x + 11} ${y - 22} ${x} ${y - 22}Z" fill="${i % 2 ? '#fff9e9' : '#f5dfb6'}" stroke="#b8935d" stroke-width="2"/>`).join('')}
    <path d="M34 111Q110 135 186 111L166 158Q110 180 54 158Z" fill="#c08a4d" stroke="#77502f" stroke-width="3"/>
    <path d="M43 124Q110 149 177 124M48 137Q110 161 172 137M54 150Q110 173 166 150M65 123L74 163M94 130L98 169M125 130L123 169M155 123L146 163" fill="none" stroke="#e5bf82" stroke-width="3"/>
    <path d="M35 111Q110 136 185 111" fill="none" stroke="#f0cd95" stroke-width="8" stroke-linecap="round"/>
  </svg>`;
}
