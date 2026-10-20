/* ホームの1枚絵。開くたびにこの中から1枚を選ぶ（前回と同じ絵は出さない）。
 * すべて viewBox="0 -96 400 456" の白黒の線画。class: ln=線, fw=紙の色で塗る, fk=インクで塗る, tw/tk=白/黒の文字 */
window.GK_SCENES = [
  {
    id: "desk", name: "研究デスク",
    svg: null // index.html の homeArt() が描く（最初の絵）
  },
  {
    id: "port", name: "港と海運",
    svg: `
  <circle class="ln fw" cx="330" cy="-46" r="22"/>
  <path class="ln" d="M52 -56q8-8 16 0q8-8 16 0M100 -76q6-6 12 0q6-6 12 0M210 -60q7-7 14 0q7-7 14 0" style="stroke-width:2"/>
  <path class="ln" d="M300 232V40M346 232V40M300 96H346M300 152H346M300 96L346 152M346 96L300 152"/>
  <path class="ln" d="M96 40H392" style="stroke-width:6"/>
  <path class="ln" d="M300 40L322 14L346 40"/>
  <rect class="fk" x="304" y="44" width="38" height="20" rx="2"/>
  <path class="ln" d="M170 40V96"/>
  <rect class="fk" x="148" y="96" width="44" height="8"/>
  <rect class="ln fw" x="150" y="104" width="40" height="24"/>
  <path class="ln" d="M160 104v24M170 104v24M180 104v24" style="stroke-width:1.4"/>
  <rect class="ln fw" x="26" y="136" width="36" height="74"/>
  <path class="ln" d="M34 152h20M34 166h20" style="stroke-width:2"/>
  <rect class="fk" x="36" y="116" width="16" height="20"/>
  <g>${[0, 1, 2, 3, 4, 5].map(i => `<rect class="ln fw" x="${70 + i * 36}" y="190" width="34" height="20"/>`).join("")}${[0, 1, 2, 3].map(i => `<rect class="${i % 2 ? "ln fw" : "fk"}" x="${88 + i * 36}" y="170" width="34" height="20"/>`).join("")}</g>
  <path class="fk" d="M14 210H292L270 252H40Z"/>
  <path class="ln" d="M292 232H400"/><rect class="ln fw" x="292" y="232" width="108" height="16"/>
  <path class="ln" d="M0 270q20-10 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" style="stroke-width:2"/>
  <path class="ln" d="M20 296q20-10 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" style="stroke-width:2"/>
  <path class="ln" d="M60 322q20-10 40 0t40 0t40 0t40 0t40 0t40 0t40 0" style="stroke-width:2"/>`
  },
  {
    id: "rail", name: "新幹線と街",
    svg: `
  <circle class="ln fw" cx="336" cy="-40" r="18"/>
  <path class="fk" d="M30 132L150 14L172 24L192 12L320 132Z"/>
  <path class="fw" d="M126 38L150 14L172 24L192 12L216 36L196 30L182 42L166 32L150 44L138 34Z"/>
  <rect class="ln fw" x="252" y="70" width="38" height="96"/><rect class="ln fw" x="296" y="40" width="44" height="126"/><rect class="ln fw" x="346" y="86" width="40" height="80"/>
  <path class="ln" d="M262 86h18M262 102h18M262 118h18M306 56h24M306 74h24M306 92h24M306 110h24M356 102h20M356 120h20" style="stroke-width:1.6"/>
  <path class="ln" d="M0 166H400"/>
  <path class="ln" d="M70 196V120H118M230 196V120H278" style="stroke-width:2"/><path class="ln" d="M0 128H400" style="stroke-width:1.2"/>
  <path class="ln fw" d="M6 196V158H286C330 158 366 170 394 196Z"/>
  <path class="fk" d="M6 182H372C380 186 386 190 394 196H6Z"/>
  <path class="ln" d="M20 170h22M54 170h22M88 170h22M122 170h22M156 170h22M190 170h22M224 170h22" style="stroke-width:5"/>
  <path class="fk" d="M300 162C326 162 346 168 364 178L300 178Z"/>
  <rect class="fk" x="0" y="200" width="400" height="14"/>
  ${[30, 130, 230, 330].map(x => `<rect class="ln fw" x="${x}" y="214" width="16" height="96"/>`).join("")}
  <path class="ln" d="M0 310H400"/>
  ${[90, 190, 290].map(x => `<circle class="ln fw" cx="${x}" cy="284" r="16"/><path class="ln" d="M${x} 300v10"/>`).join("")}`
  },
  {
    id: "shop", name: "商店街",
    svg: `
  <rect class="ln fw" x="34" y="-50" width="332" height="300"/>
  <rect class="fk" x="90" y="-34" width="220" height="40" rx="4"/>
  <text class="tw" x="200" y="-7" text-anchor="middle" font-size="20" letter-spacing="4">MARKET</text>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="${i % 2 ? "fw" : "fk"}" x="${34 + i * 41.5}" y="26" width="41.5" height="40"/><path class="${i % 2 ? "ln fw" : "fk"}" d="M${34 + i * 41.5} 66a20.75 14 0 0 0 41.5 0Z"/>`).join("")}
  <path class="ln" d="M34 26H366" style="stroke-width:2.4"/>
  <rect class="ln fw" x="58" y="104" width="140" height="118"/>
  <path class="ln" d="M58 146H198M58 186H198" style="stroke-width:2"/>
  <rect class="fk" x="70" y="122" width="18" height="24"/><rect class="ln fw" x="96" y="128" width="20" height="18"/><circle class="fk" cx="134" cy="136" r="10"/><rect class="fk" x="154" y="118" width="12" height="28"/><rect class="ln fw" x="172" y="126" width="18" height="20"/>
  <circle class="ln fw" cx="80" cy="174" r="11"/><rect class="fk" x="100" y="162" width="26" height="24"/><rect class="ln fw" x="134" y="166" width="16" height="20"/><rect class="fk" x="160" y="158" width="22" height="28"/>
  <rect class="ln fw" x="230" y="104" width="104" height="146"/>
  <rect class="ln fw" x="246" y="120" width="72" height="80"/>
  <path class="ln" d="M318 176h8" style="stroke-width:4"/>
  <path class="ln" d="M262 104l20-16l20 16"/><rect class="fk" x="256" y="134" width="52" height="20" rx="3"/>
  <text class="tw" x="282" y="149" text-anchor="middle" font-size="12">OPEN</text>
  <path class="ln" d="M0 250H400"/><path class="ln" d="M0 276H400M40 250l-20 26M120 250l-20 26M200 250l-20 26M280 250l-20 26M360 250l-20 26" style="stroke-width:1.4"/>
  <path class="ln fw" d="M18 236h28l-4 14H22z"/><path class="fk" d="M32 236c-14-6-16-22-6-30c8 8 10 20 6 30z"/>
  <path class="ln" d="M350 300l10-40h28M356 284h28l4-18" style="stroke-width:2.4"/><circle class="ln fw" cx="362" cy="306" r="7"/><circle class="ln fw" cx="384" cy="306" r="7"/>`
  },
  {
    id: "factory", name: "ものづくり",
    svg: `
  <path class="ln" d="M0 -30L60 -76V-30L120 -76V-30L180 -76V-30L240 -76V-30L300 -76V-30L360 -76V-30L400 -60"/>
  <path class="ln" d="M0 -30H400"/>
  <rect class="ln fw" x="24" y="0" width="108" height="72" rx="4"/>
  <path class="ln" d="M36 58l20-16l18 10l24-24l22 8" style="stroke-width:2"/><path class="ln" d="M36 14h40" style="stroke-width:1.6"/>
  <circle cx="330" cy="40" r="34" fill="none" stroke="var(--ink)" stroke-width="14" stroke-dasharray="9 8"/>
  <circle class="ln fw" cx="330" cy="40" r="26"/><circle class="fk" cx="330" cy="40" r="8"/>
  <circle cx="270" cy="92" r="20" fill="none" stroke="var(--ink)" stroke-width="10" stroke-dasharray="6 6"/>
  <circle class="ln fw" cx="270" cy="92" r="15"/><circle class="fk" cx="270" cy="92" r="5"/>
  <rect class="fk" x="238" y="186" width="70" height="34" rx="4"/>
  <path class="ln" d="M272 186L250 120L176 104" style="stroke-width:16"/>
  <path class="ln" d="M272 186L250 120L176 104" style="stroke:var(--paper);stroke-width:8"/>
  <circle class="ln fw" cx="250" cy="120" r="12"/><circle class="ln fw" cx="272" cy="186" r="10"/>
  <path class="ln" d="M176 104V128M166 128H186M166 128V142M186 128V142" style="stroke-width:3"/>
  <rect class="fk" x="160" y="186" width="34" height="30" rx="3"/>
  <path class="ln" d="M164 186v-6M172 186v-6M180 186v-6M188 186v-6M164 216v6M172 216v6M180 216v6M188 216v6" style="stroke-width:2"/>
  <rect class="ln fw" x="10" y="228" width="380" height="20" rx="10"/>
  ${[30, 70, 110, 150, 190, 230, 270, 310, 350].map(x => `<circle class="ln" cx="${x}" cy="238" r="5" style="stroke-width:1.6"/>`).join("")}
  <rect class="ln fw" x="34" y="184" width="54" height="44"/><path class="ln" d="M34 200h54M61 184v16" style="stroke-width:1.6"/>
  <rect class="ln fw" x="98" y="196" width="44" height="32"/><path class="ln" d="M98 208h44" style="stroke-width:1.6"/>
  <rect class="ln fw" x="324" y="196" width="48" height="32"/>
  <path class="ln" d="M40 248v62M360 248v62M20 310H380"/>`
  },
  {
    id: "bank", name: "金融街",
    svg: `
  <rect class="ln fw" x="8" y="-30" width="48" height="280"/><rect class="ln fw" x="344" y="-70" width="48" height="320"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<path class="ln" d="M18 ${-12 + i * 24}h28" style="stroke-width:1.4"/><path class="ln" d="M354 ${-52 + i * 28}h28" style="stroke-width:1.4"/>`).join("")}
  <path class="ln" d="M76 -40l40-22l30 12l44-40" style="stroke-width:3"/><path class="ln" d="M172 -92l18 2l-4 18" style="stroke-width:3"/>
  <path class="ln fw" d="M70 54L200 -6L330 54Z"/>
  <circle class="fk" cx="200" cy="32" r="12"/><text class="tw" x="200" y="37" text-anchor="middle" font-size="13">¥</text>
  <rect class="fk" x="70" y="54" width="260" height="18"/>
  ${[86, 132, 178, 224, 270].map(x => `<rect class="ln fw" x="${x}" y="72" width="24" height="132"/><path class="ln" d="M${x + 8} 80v116M${x + 16} 80v116" style="stroke-width:1.2"/>`).join("")}
  <rect class="ln fw" x="62" y="204" width="276" height="14"/><rect class="ln fw" x="50" y="218" width="300" height="14"/>
  <path class="ln" d="M0 250H400"/>
  <g>${[0, 1, 2, 3, 4].map(i => `<ellipse class="ln fw" cx="96" cy="${300 - i * 9}" rx="22" ry="6"/>`).join("")}${[0, 1, 2].map(i => `<ellipse class="ln fw" cx="146" cy="${300 - i * 9}" rx="22" ry="6"/>`).join("")}${[0, 1, 2, 3, 4, 5, 6].map(i => `<ellipse class="${i === 6 ? "fk" : "ln fw"}" cx="300" cy="${300 - i * 9}" rx="22" ry="6"/>`).join("")}</g>
  <path class="ln" d="M190 310l18-28l18 14l22-36" style="stroke-width:2.4"/>`
  }
];
