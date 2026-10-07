// One character illustration for both the editor and the world. Colors are
// selected from the server's fixed palette before they reach this markup.
export function avatarMarkup({ skin, hair, clothes }, { eggs = 0 } = {}) {
  return `<svg class="character" viewBox="0 0 160 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your Oasis character${eggs > 0 ? ' carrying an egg basket' : ''}">
    <defs>
      <linearGradient id="shirt" x2=".85" y2="1"><stop stop-color="${clothes}"/><stop offset="1" stop-color="${clothes}" stop-opacity=".72"/></linearGradient>
      <linearGradient id="face" x2=".85" y2="1"><stop stop-color="#fff" stop-opacity=".25"/><stop offset=".45" stop-color="${skin}"/><stop offset="1" stop-color="${skin}"/></linearGradient>
      <filter id="shade" x="-.3" y="-.3" width="1.6" height="1.7"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#352b21" flood-opacity=".25"/></filter>
    </defs>
    <ellipse cx="80" cy="181" rx="43" ry="7" fill="#493925" opacity=".2"/>
    <g filter="url(#shade)">
      <path d="M57 134v31q0 8 8 8h11v-34zm27 5v34h11q8 0 8-8v-31z" fill="#634b3d"/>
      <path d="M62 165h17v13H54q-3-8 8-13zm19 0h17q11 5 8 13H81z" fill="#322b2b"/>
      <path d="M53 97q-10 3-13 19l-5 26q0 9 8 9t10-8l9-23zm54 0q10 3 13 19l5 26q0 9-8 9t-10-8l-9-23z" fill="${skin}"/>
      <path d="M63 95q-13 2-17 18l-4 29 13 3 7-24-2 34h40l-2-34 7 24 13-3-4-29q-4-16-17-18z" fill="url(#shirt)" stroke="#624c36" stroke-opacity=".23" stroke-width="2"/>
      <path d="M64 104q16 13 32 0" fill="none" stroke="#ffefd3" stroke-opacity=".75" stroke-width="3"/>
      <path d="M60 144h40v8H60z" fill="#6a4730"/><rect x="76" y="144" width="9" height="8" rx="2" fill="#e7bb62"/>
      <path d="M64 76h32v26q-16 12-32 0z" fill="${skin}"/>
      <ellipse cx="80" cy="63" rx="35" ry="39" fill="url(#face)" stroke="#543623" stroke-opacity=".22" stroke-width="2"/>
      <ellipse cx="45" cy="66" rx="5" ry="8" fill="${skin}"/><ellipse cx="115" cy="66" rx="5" ry="8" fill="${skin}"/>
      <path d="M43 66Q38 36 56 22q13-13 34-9 26 4 30 32l-3 21-7-5-3-21q-10 5-23 1-20-7-31 7l-3 14z" fill="${hair}"/>
      <circle cx="54" cy="29" r="11" fill="${hair}"/><circle cx="68" cy="18" r="12" fill="${hair}"/><circle cx="84" cy="17" r="12" fill="${hair}"/><circle cx="100" cy="24" r="13" fill="${hair}"/><circle cx="112" cy="39" r="12" fill="${hair}"/><circle cx="46" cy="43" r="11" fill="${hair}"/>
      <path d="M54 48q8-11 20-8m10 0q10 8 23 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3" stroke-linecap="round"/>
      <path d="M58 62q6-5 13 0m18 0q7-5 13 0" fill="none" stroke="#302622" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="65" cy="66" rx="2.7" ry="3.4" fill="#251d1b"/><ellipse cx="95" cy="66" rx="2.7" ry="3.4" fill="#251d1b"/>
      <circle cx="66" cy="65" r=".9" fill="white"/><circle cx="96" cy="65" r=".9" fill="white"/>
      <path d="M79 68q-3 7 1 8" fill="none" stroke="#704936" stroke-opacity=".65" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M73 82q7 6 14 0" fill="none" stroke="#713c3b" stroke-width="2.3" stroke-linecap="round"/>
      <ellipse cx="56" cy="77" rx="6" ry="3" fill="#df7770" opacity=".25"/><ellipse cx="104" cy="77" rx="6" ry="3" fill="#df7770" opacity=".25"/>
      ${eggs > 0 ? `<g data-basket="eggs">
        <path d="M105 145q0-28 17-28t17 28" fill="none" stroke="#79512e" stroke-width="5"/>
        <ellipse cx="122" cy="145" rx="23" ry="7" fill="#76512e"/>
        <ellipse cx="112" cy="140" rx="6" ry="9" transform="rotate(-18 112 140)" fill="#fff3d5" stroke="#d7c39b"/>
        <ellipse cx="123" cy="138" rx="6" ry="9" fill="#f9ead0" stroke="#d7c39b"/>
        <ellipse cx="134" cy="141" rx="6" ry="8" transform="rotate(18 134 141)" fill="#fff8e8" stroke="#d7c39b"/>
        <path d="M99 144l5 22q18 9 36 0l5-22q-23 9-46 0z" fill="#bd8747" stroke="#79512e" stroke-width="2"/>
        <path d="M104 152q18 7 36 0m-34 8q16 6 32 0m-27-11 2 17m9-15v18m10-20-2 17" fill="none" stroke="#e2b472" stroke-width="2"/>
        <path d="M116 137l5-10" fill="none" stroke="${skin}" stroke-width="10" stroke-linecap="round"/>
        <ellipse cx="122" cy="126" rx="6" ry="5" fill="${skin}"/>
      </g>` : ''}
    </g>
  </svg>`;
}
