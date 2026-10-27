import './story-film-stage.css';

// Presentation only: the director owns narration, choices and learning state.
let stageNumber = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const position = (x, y, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;
const gardenGeometry = garden => ({ x: garden === 'right' ? 266 : 176, y: 341 });
const SCENE_DESCRIPTION = 'Minik Aslan ve Pırpır, bahçenin yanındaki su değirmeninde.';
const initialPositions = scene => Number(scene) >= 4
  ? { lion: [438, 490], bird: [253, 285] }
  : Number(scene) >= 1 ? { lion: [546, 477], bird: [642, 307] } : { lion: [225, 491], bird: [337, 348] };

function definitions(id) {
  return `<defs>
    <linearGradient id="${id}-fur" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffd77b"/><stop offset=".52" stop-color="#f4b34d"/><stop offset="1" stop-color="#db8732"/></linearGradient>
    <radialGradient id="${id}-face" cx=".36" cy=".28" r=".83"><stop stop-color="#ffe5a0"/><stop offset=".73" stop-color="#ffc65f"/><stop offset="1" stop-color="#e8a043"/></radialGradient>
    <radialGradient id="${id}-mane" cx=".42" cy=".3" r=".78"><stop stop-color="#d77b33"/><stop offset=".65" stop-color="#b95628"/><stop offset="1" stop-color="#913a22"/></radialGradient>
    <linearGradient id="${id}-cream" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff5ce"/><stop offset="1" stop-color="#ffe2a3"/></linearGradient>
    <linearGradient id="${id}-bird" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8be4dd"/><stop offset=".5" stop-color="#33b8bb"/><stop offset="1" stop-color="#178b9b"/></linearGradient>
    <linearGradient id="${id}-wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e9daf"/><stop offset="1" stop-color="#286a86"/></linearGradient>
    <linearGradient id="${id}-wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b57c43"/><stop offset=".4" stop-color="#936037"/><stop offset="1" stop-color="#633b25"/></linearGradient>
    <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a2ecf6"/><stop offset="1" stop-color="#2eacc9"/></linearGradient>
    <linearGradient id="${id}-petal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe68a"/><stop offset="1" stop-color="#f6b93a"/></linearGradient>
    <filter id="${id}-shadow" x="-70%" y="-100%" width="240%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>`;
}

function lionArt(id, xy) {
  return `<g class="film-actor film-lion" data-film-actor="lion" data-film-pose="standing" data-film-speaking="false" style="transform:${position(...xy)}">
    <ellipse class="film-ground-shadow" cx="3" cy="3" rx="57" ry="11" fill="#634421" opacity=".25" filter="url(#${id}-shadow)"/>
    <g class="film-lion-tail" data-film-joint="tail"><path d="M-28-57C-72-43-85-85-77-103" fill="none" stroke="#814524" stroke-width="12" stroke-linecap="round"/><path d="M-28-59C-69-44-82-85-76-103" fill="none" stroke="#eaa44b" stroke-width="7" stroke-linecap="round"/><path d="M-79-94Q-95-108-78-124Q-62-121-68-104Q-72-96-79-94Z" fill="url(#${id}-mane)" stroke="#814524" stroke-width="2.5"/><path d="M-78-115Q-84-108-77-103" fill="none" stroke="#edaa64" stroke-width="2" opacity=".6"/></g>
    <g class="film-lion-leg" data-film-joint="left-leg"><path d="M-30-59Q-44-42-32-9L-36-2Q-23 8-7-1L-10-48Z" fill="url(#${id}-fur)" stroke="#955729" stroke-width="3"/><path d="M-31-13Q-19-18-10-10L-6-2Q-16 8-33 2Q-42-3-31-13Z" fill="url(#${id}-cream)" stroke="#955729" stroke-width="2.5"/><path d="M-27-3V2M-18-4V3" stroke="#c29153" stroke-width="1.7" stroke-linecap="round"/></g>
    <g class="film-lion-leg" data-film-joint="right-leg"><path d="M9-57Q35-57 31-34L26-8Q47 3 28 8L8 6Q-3 1 5-13L1-43Z" fill="url(#${id}-fur)" stroke="#955729" stroke-width="3"/><path d="M9-12Q22-17 29-9Q45-5 37 3Q22 10 7 4Z" fill="url(#${id}-cream)" stroke="#955729" stroke-width="2.5"/><path d="M21-3V5M30-3V4" stroke="#c29153" stroke-width="1.7" stroke-linecap="round"/></g>
    <g data-film-joint="torso"><path d="M-30-118Q-51-100-41-66Q-39-38-8-35Q26-31 40-58Q49-86 26-118Z" fill="url(#${id}-fur)" stroke="#995829" stroke-width="3.2"/><path d="M-13-101Q-33-89-25-63Q-16-43 6-47Q28-53 24-76Q23-99 5-104Z" fill="url(#${id}-cream)"/><path d="M-30-80Q-26-93-22-95M31-67Q34-80 31-86" fill="none" stroke="#ffe19a" stroke-width="3" stroke-linecap="round" opacity=".65"/></g>
    <g class="film-lion-arm" data-film-joint="left-arm"><path d="M-32-109Q-49-115-53-96L-54-76Q-65-62-52-55Q-43-51-37-62L-27-93Z" fill="url(#${id}-fur)" stroke="#995829" stroke-width="3"/><path d="M-53-77Q-63-73-60-64Q-57-53-47-58Q-37-63-44-72Z" fill="url(#${id}-cream)" stroke="#995829" stroke-width="2.5"/><path d="M-54-63L-52-68M-48-61L-46-66" stroke="#bd8a49" stroke-width="1.6" stroke-linecap="round"/></g>
    <g class="film-lion-head" data-film-joint="head">
      <path d="M-47-184Q-46-205-28-205Q-15-218 0-207Q17-218 31-202Q51-205 54-184Q73-176 64-158Q78-143 64-127Q67-106 48-103Q45-82 25-86Q11-69-6-83Q-24-72-38-88Q-58-87-60-106Q-78-113-67-132Q-80-148-66-163Q-69-182-47-184Z" fill="url(#${id}-mane)" stroke="#854525" stroke-width="2.8"/>
      <path d="M-45-178Q-50-195-31-198M-13-200Q-2-207 9-199M30-195Q43-192 45-181M55-159Q65-149 57-139M51-117Q52-105 40-102M19-91Q7-85-2-92M-28-99Q-39-96-43-109M-55-132Q-64-143-56-153" fill="none" stroke="#e59548" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <g data-film-joint="left-ear"><circle cx="-37" cy="-183" r="18" fill="url(#${id}-fur)" stroke="#945127" stroke-width="3"/><circle cx="-37" cy="-182" r="10" fill="#d88e5e"/><path d="M-41-186Q-35-189-31-183" fill="none" stroke="#f5be88" stroke-width="2" stroke-linecap="round"/></g>
      <g data-film-joint="right-ear"><circle cx="36" cy="-182" r="18" fill="url(#${id}-fur)" stroke="#945127" stroke-width="3"/><circle cx="36" cy="-181" r="10" fill="#d88e5e"/><path d="M32-185Q37-189 42-182" fill="none" stroke="#f5be88" stroke-width="2" stroke-linecap="round"/></g>
      <path d="M-42-171Q-43-194-19-195Q-1-204 21-191Q44-189 45-166L44-140Q40-112 12-108Q-20-103-38-124Q-47-143-42-171Z" fill="url(#${id}-face)" stroke="#ac682d" stroke-width="2.5"/>
      <path d="M-17-194Q-20-203-9-207L-8-199Q0-209 9-201L6-195" fill="#ffd47a" stroke="#ae672e" stroke-width="2" stroke-linejoin="round"/>
      <path class="film-lion-brow film-lion-brow-left" d="M-30-172Q-22-179-13-174" fill="none" stroke="#9a552a" stroke-width="4" stroke-linecap="round"/><path class="film-lion-brow" d="M12-174Q22-179 30-171" fill="none" stroke="#9a552a" stroke-width="4" stroke-linecap="round"/>
      <g data-film-joint="eyes"><ellipse cx="-21" cy="-158" rx="9.7" ry="13.3" fill="#fffaf1"/><ellipse cx="23" cy="-158" rx="9.7" ry="13.3" fill="#fffaf1"/><g class="film-lion-pupils"><ellipse cx="-18" cy="-156" rx="5.8" ry="8.7" fill="#553c29"/><ellipse cx="26" cy="-156" rx="5.8" ry="8.7" fill="#553c29"/><circle cx="-16" cy="-160" r="2.4" fill="white"/><circle cx="28" cy="-160" r="2.4" fill="white"/></g></g>
      <ellipse cx="-33" cy="-143" rx="10" ry="6" fill="#ef9d65" opacity=".55"/><ellipse cx="35" cy="-143" rx="10" ry="6" fill="#ef9d65" opacity=".55"/>
      <g class="film-lion-mouth" data-film-joint="mouth"><path d="M-13-129Q1-122 16-131Q15-109 1-109Q-12-112-13-129Z" fill="#713a2d" stroke="#9a592e" stroke-width="1.8"/><path d="M-7-114Q2-120 10-113Q2-106-7-114Z" fill="#ec998e"/></g>
      <path d="M-1-143Q-18-157-29-143Q-37-125-18-123Q-8-122 0-132Q10-121 23-125Q39-132 28-145Q16-156-1-143Z" fill="url(#${id}-cream)" stroke="#d69b53" stroke-width="1.8"/>
      <path d="M-9-148Q1-154 12-147Q10-138 1-137Q-6-139-9-148Z" fill="#74432e"/><path d="M-4-147L3-147" stroke="#a16b4b" stroke-width="2" stroke-linecap="round"/>
      <path class="film-mouth-smile" d="M1-138V-131Q-5-126-11-129M1-131Q8-125 15-130" fill="none" stroke="#8e552f" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="#b5864c"><circle cx="-22" cy="-137" r="1.5"/><circle cx="-15" cy="-141" r="1.3"/><circle cx="-16" cy="-132" r="1.2"/><circle cx="24" cy="-137" r="1.5"/><circle cx="18" cy="-141" r="1.3"/><circle cx="19" cy="-132" r="1.2"/></g>
    </g>
    <g class="film-lion-scarf" data-film-joint="scarf"><path d="M-28-111Q1-96 30-111L26-100Q1-84-26-101Z" fill="var(--film-ribbon-dark,#268e92)" stroke="#50684d" stroke-width="2.2"/><path d="M12-99L30-91L17-63L8-79L-5-73L2-98Z" fill="var(--film-ribbon,#38b2b1)" stroke="#50684d" stroke-width="2.3"/><path d="M9-94L15-77" stroke="#fff1b4" opacity=".55" stroke-width="3" stroke-linecap="round"/></g>
    <g class="film-lion-arm" data-film-joint="right-arm"><path d="M34-107Q49-107 49-90L48-72Q58-60 48-53Q37-47 32-60L24-89Q20-102 34-107Z" fill="url(#${id}-fur)" stroke="#995829" stroke-width="3"/><path d="M39-75Q50-78 56-67Q62-54 48-51Q34-52 36-64Z" fill="url(#${id}-cream)" stroke="#995829" stroke-width="2.5"/><path d="M46-55L44-61M53-58L50-64" stroke="#bd8a49" stroke-width="1.7" stroke-linecap="round"/></g>
  </g>`;
}

function birdArt(id, xy) {
  return `<g class="film-actor film-bird" data-film-actor="bird" data-film-pose="perched" data-film-speaking="false" style="transform:${position(...xy)}">
    <ellipse class="film-bird-shadow" cy="4" rx="28" ry="5" fill="#3b5c4c" opacity=".16"/>
    <g data-film-joint="tail"><path d="M-19-24Q-49-22-52-43Q-35-46-21-34Q-46-39-40-53Q-22-51-12-33Z" fill="url(#${id}-wing)" stroke="#226779" stroke-width="2.2"/><path d="M-43-44L-24-33" stroke="#62c3cf" stroke-width="2" stroke-linecap="round"/></g>
    <g data-film-joint="left-wing"><path d="M-10-31Q-25-50-21-66Q-9-62 1-40Q4-56 11-56Q18-35 5-22Z" fill="url(#${id}-wing)" stroke="#226779" stroke-width="2.2"/></g>
    <g class="film-bird-feet"><path d="M-9-10L-11 2M10-10L9 2M-16 3L-10 1L-5 3M5 3L10 1L16 3" fill="none" stroke="#b07935" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
    <path d="M-26-35Q-26-61 0-62Q27-63 33-38Q37-13 14-7Q-17 2-27-20Z" fill="url(#${id}-bird)" stroke="#237789" stroke-width="2.5"/><path d="M-6-36Q14-44 23-31Q29-16 11-11Q-8-7-13-18Q-17-29-6-36Z" fill="#cbf1de"/>
    <g data-film-joint="head"><path d="M-5-57Q-16-64-11-72Q-2-72 3-64Q3-77 11-77Q18-69 12-61" fill="#41b8bc" stroke="#237789" stroke-width="2" stroke-linejoin="round"/><path d="M-12-54Q-11-70 9-69Q32-66 34-47Q32-28 10-29Q-10-29-12-46Z" fill="url(#${id}-bird)" stroke="#237789" stroke-width="2.2"/><path d="M16-57Q27-62 30-49Q32-36 19-36Q7-38 11-49Z" fill="#f5f9d9"/><g data-film-joint="eyes"><ellipse cx="23" cy="-49" rx="5" ry="7" fill="#344742"/><circle cx="25" cy="-51" r="1.9" fill="white"/></g><path d="M13-60Q20-64 26-60" fill="none" stroke="#247181" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="18" cy="-37" rx="5" ry="3" fill="#edc591" opacity=".65"/><path d="M31-45Q46-45 47-39L31-36Z" fill="#f6bc4b" stroke="#b87d31" stroke-width="1.8"/><g data-film-joint="mouth"><path d="M31-37L46-39Q42-30 31-31Z" fill="#e8a13b" stroke="#b87d31" stroke-width="1.8"/></g></g>
    <g data-film-joint="right-wing"><path d="M-16-40Q2-40 7-25Q-2-8-18-14Q-29-21-25-34Q-23-40-16-40Z" fill="url(#${id}-wing)" stroke="#226779" stroke-width="2.3"/><path d="M-17-31Q-11-21-3-22M-22-25Q-16-15-9-17" fill="none" stroke="#68c3c8" stroke-width="2" stroke-linecap="round"/></g><path d="M-9-55Q-5-59 0-58" fill="none" stroke="#a3ebe0" stroke-width="2.5" stroke-linecap="round"/>
  </g>`;
}

function wheelArt(id, running) {
  const paddles = Array.from({ length: 12 }, (_, i) => `<g transform="rotate(${i * 30})"><path d="M-8-79L10-79L13-57L-9-57Z" fill="url(#${id}-wood)" stroke="#5c3927" stroke-width="2.5"/><path d="M-4-75L5-75" stroke="#d5a365" stroke-width="2" stroke-linecap="round"/><path d="M-4-63L-4-13L4-13L5-63Z" fill="#a77544" stroke="#64402a" stroke-width="1.7"/></g>`).join('');
  return `<g data-film-prop="wheel" data-film-state="${running ? 'running' : 'stopped'}" transform="translate(788 259)"><ellipse cx="7" cy="11" rx="82" ry="80" fill="#36291c" opacity=".18" filter="url(#${id}-shadow)"/><g class="film-wheel-rotor"><circle r="67" fill="#503b27" opacity=".34"/>${paddles}<circle r="59" fill="none" stroke="#5e3b27" stroke-width="15"/><circle r="59" fill="none" stroke="#b17b45" stroke-width="8"/><circle r="51" fill="none" stroke="#d2a16a" stroke-width="2" opacity=".7"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${(59 * Math.sin(i * Math.PI / 6)).toFixed(2)}" cy="${(59 * Math.cos(i * Math.PI / 6)).toFixed(2)}" r="2.6" fill="#4c4b3d" stroke="#d3b681" stroke-width=".8"/>`).join('')}<circle r="15" fill="#a37340" stroke="#533a28" stroke-width="4"/><circle r="7" fill="#5a6255" stroke="#bfb38a" stroke-width="2"/><path d="M-4-4L4 4M4-4L-4 4" stroke="#d5cba9" stroke-width="1.2"/></g><path d="M0 0L17 3" stroke="#58452f" stroke-width="8" stroke-linecap="round"/><g class="film-wheel-splash" style="opacity:${running ? 1 : 0}"><path d="M-48 67Q-53 51-60 54Q-65 61-54 69M-33 76Q-35 62-42 66Q-44 72-39 78M-62 64L-69 59" fill="#c5f5ef" stroke="#5bbcd1" stroke-width="2" stroke-linecap="round"/></g></g>`;
}

function gateArt(id, open, count) {
  return `<g data-film-prop="gate" data-film-state="${open ? 'open' : 'closed'}" transform="translate(570 329)"><path d="M-38 19L-33-37M39 18L43-38" fill="none" stroke="#5c402b" stroke-width="10" stroke-linecap="round"/><path d="M-37-34L44-35" stroke="#ac8050" stroke-width="13" stroke-linecap="round"/><g class="film-gate-panel" style="transform:translateY(${open ? -42 : 0}px)"><path d="M-29-24L36-25L31 22L-33 20Z" fill="url(#${id}-wood)" stroke="#66452c" stroke-width="3"/><path d="M-31-9L34-10M-32 6L33 5" stroke="#59412b" stroke-width="2"/><path d="M-23-21L-27 17M27-22L22 18" stroke="#bf945b" stroke-width="5"/><g fill="#5d6453"><circle cx="-24" cy="-14" r="2"/><circle cx="-26" cy="10" r="2"/><circle cx="26" cy="-14" r="2"/><circle cx="24" cy="11" r="2"/></g></g><path d="M46-33L60-4L63 9" fill="none" stroke="#565e50" stroke-width="6" stroke-linecap="round"/><path class="film-gate-handle" d="M59-8L78-17" stroke="#b88a48" stroke-width="8" stroke-linecap="round"/></g>
    <g data-film-prop="leaves" data-film-state="${count ? 'blocked' : 'cleared'}" transform="translate(561 350)" style="opacity:${count ? 1 : 0}">${Array.from({ length: 4 }, (_, i) => `<g class="film-leaf-position" data-film-leaf="${i}" style="opacity:${i < count ? 1 : 0}" transform="translate(${i * 12 - 20} ${i % 2 ? -5 : 1}) rotate(${i * 31 - 40})"><g class="film-loose-leaf"><path d="M-10 0Q-15-17 0-23Q14-15 10-3Q4 7-10 0Z" fill="${['#c98d3e', '#b0a448', '#daaa4f', '#a58438'][i]}" stroke="#82643c" stroke-width="1.5"/><path d="M-8 3L1-18M-2-5L-9-10M-1-10L6-14" fill="none" stroke="#e5c97b" stroke-width="1.3"/></g></g>`).join('')}</g>`;
}

function gardenArt(id, grown, garden, watered) {
  const { x, y } = gardenGeometry(garden);
  return `<g data-film-prop="garden-water" data-film-state="${watered ? 'flowing' : 'dry'}" style="opacity:${watered ? 1 : 0}"><path d="M528 378Q440 384 356 365Q290 351 ${x} ${y}" fill="none" stroke="#397e86" stroke-width="14" stroke-linecap="round" opacity=".6"/><path class="film-garden-current" d="M528 378Q440 384 356 365Q290 351 ${x} ${y}" fill="none" stroke="url(#${id}-water)" stroke-width="8" stroke-linecap="round"/><path d="M498 377L476 377M439 374L425 372M375 366L358 362M298 350L283 347" fill="none" stroke="#e3ffff" stroke-width="2" stroke-linecap="round"/></g>
    <g data-film-prop="plant" data-film-state="${grown ? 'flower' : 'seedling'}" transform="translate(${x} ${y})"><ellipse cy="1" rx="25" ry="5" fill="#6b4a2c" opacity=".35"/><g class="film-plant-stem" style="transform:scale(${grown ? 1 : .45})"><path d="M0 0Q-5-21 1-46L0-66" fill="none" stroke="#4e7a35" stroke-width="5" stroke-linecap="round"/><path d="M-1-26Q-29-24-29-43Q-8-50-1-26Z" fill="#77a744" stroke="#4f7e37" stroke-width="2"/><path d="M0-38Q27-39 28-57Q8-61 0-38Z" fill="#97bd55" stroke="#4f7e37" stroke-width="2"/><path d="M-2-27L-23-40M2-39L22-53" stroke="#cee393" stroke-width="1.4"/></g><g class="film-flower-head" style="opacity:${grown ? 1 : 0};transform:translate(0px,-68px) scale(${grown ? 1 : .05})"><path d="M-28-26Q-34-1-20 12Q-12 22 0 22Q18 21 28 5Q35-10 27-29L11-15L0-34L-12-15Z" fill="#f2b849" stroke="#bf7838" stroke-width="2.2"/><path d="M-28-26Q-11-22 1-3Q7 9 0 22Q-22 16-28-2Z" fill="#ed8e60" stroke="#c57548" stroke-width="1.8"/><path d="M27-29Q9-20 0-1Q-5 9 0 22Q22 13 28-5Z" fill="#f7bd64" stroke="#c98d42" stroke-width="1.8"/><path d="M0-34Q-13-10 0 4Q14-11 0-34Z" fill="#ffd685" stroke="#dcaa55" stroke-width="1.8"/><path d="M-19-14Q-13 2-5 10M19-15Q15-1 8 6" fill="none" stroke="#ffdeb0" stroke-width="2.2" stroke-linecap="round" opacity=".65"/></g></g>
    <g data-film-prop="watering-can" style="opacity:0;transform:translate(${x + 60}px,${y + 3}px)"><path d="M-16-10Q-39-27-40-8Q-40 6-20 6" fill="none" stroke="#467783" stroke-width="6"/><path d="M-22-12L9-12L12 14Q-7 22-25 11Z" fill="#71bac1" stroke="#3f7885" stroke-width="2.5"/><path d="M-22-9L-44-22L-48-17L-23 5" fill="#71bac1" stroke="#3f7885" stroke-width="2.5"/><ellipse cx="-48" cy="-20" rx="7" ry="4" transform="rotate(30 -48 -20)" fill="#9bd2d0" stroke="#3f7885" stroke-width="2"/><path d="M-17-9L-17 6M-10-10L-10 10" stroke="#b7e0dc" stroke-width="2" stroke-linecap="round"/><g class="film-watering-drops" style="opacity:0"><path d="M-51-14L-57-5M-45-13L-47-1M-56-16L-64-9" fill="none" stroke="#c3f6fc" stroke-width="3" stroke-linecap="round"/></g></g>`;
}

function labelArt(id, garden, label) {
  const { x, y } = gardenGeometry(garden);
  return `<g data-film-prop="label" transform="translate(${x + 61} ${y + 2})" style="opacity:${label ? 1 : 0}"><path d="M-4-42L4-42L3 11L-3 11Z" fill="url(#${id}-wood)" stroke="#805431" stroke-width="1.8"/><path d="M-38-72L31-74L40-65L36-39L-37-37Z" fill="#d6ad69" stroke="#8b6038" stroke-width="2.4"/><path d="M-31-67L27-69M-29-43L28-45" stroke="#efd29a" stroke-width="1.5" stroke-linecap="round"/><circle cx="-29" cy="-56" r="2" fill="#7b613c"/><text x="3" y="-47" text-anchor="middle" font-family="'Nunito Sans',sans-serif" font-size="22" font-weight="800" fill="#69442a">${escape(label)}</text><g data-film-prop="ribbon" transform="translate(5 -28)"><path d="M0 0Q-26-23-24-7Q-23 6 0 0Q25-22 25-6Q24 7 0 0Z" fill="var(--film-ribbon,#38b2b1)" stroke="var(--film-ribbon-dark,#268e92)" stroke-width="1.8"/><path d="M-2 0L-16 20L-5 17L1 23L7 0L21 18L21 8L29 11L8-4Z" fill="var(--film-ribbon,#38b2b1)" stroke="var(--film-ribbon-dark,#268e92)" stroke-width="1.6"/><circle r="5" fill="var(--film-ribbon-dark,#268e92)"/></g></g>`;
}

export function renderFilmStage({ assetBase = '/', scene = 0, garden = 'left', branch = 'bird', phase = 'opening', millRunning = false, watered = millRunning, gateOpen = false, leafCount = 4, flowerGrown = false, ribbon = 'teal', label = '' } = {}) {
  const id = `film-art-${++stageNumber}`;
  const base = String(assetBase || '/').replace(/\/?$/, '/');
  const actors = initialPositions(scene);
  return `<div class="film-stage" role="img" aria-label="${escape(label || SCENE_DESCRIPTION)}" data-film-scene="${Number(scene) || 0}" data-film-garden="${escape(garden)}" data-film-branch="${escape(branch)}" data-film-ribbon="${escape(ribbon)}" data-film-phase="${escape(phase)}" data-film-animating="false" data-film-paused="false"><img class="film-stage-background" src="${escape(base)}art/story-watermill-v1.png" alt="" draggable="false" decoding="async"/><svg class="film-stage-art" viewBox="0 0 1000 563" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${definitions(id)}
    <g data-film-prop="sunlight" style="opacity:0"><path d="M-40-60L525 510L745 330L240-60Z" fill="#fff8bd" opacity=".24"/><path d="M60-70L710 390L805 272L310-60Z" fill="#fff5bd" opacity=".18"/></g>
    ${wheelArt(id, millRunning)}
    <g data-film-prop="stream" data-film-state="${millRunning ? 'flowing' : 'quiet'}" style="opacity:${millRunning ? .8 : 0}"><path class="film-stream-current" d="M554 338Q532 363 561 384Q586 399 631 403M562 350Q552 368 575 379M611 397Q650 399 697 417" fill="none" stroke="#dbffff" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="22 17 8 19"/><path d="M543 350Q528 341 528 353M582 355Q596 342 598 352" fill="none" stroke="#bcf3ed" stroke-width="3" stroke-linecap="round"/></g>
    ${gateArt(id, gateOpen, Number(leafCount) || 0)}${gardenArt(id, flowerGrown, garden, watered)}${labelArt(id, garden, label)}
    <g data-film-prop="basket" transform="translate(667 440)"><ellipse cy="7" rx="31" ry="5" fill="#563c28" opacity=".2"/><path d="M-19-17Q-18-45 1-45Q20-44 20-16" fill="none" stroke="#7e5834" stroke-width="5"/><path d="M-29-18L28-18L21 10Q-1 19-22 9Z" fill="#b98d4d" stroke="#7d5834" stroke-width="2.5"/><path d="M-25-8L25-8M-23 1L23 1M-17-17L-13 11M-5-17L-4 14M7-17L6 14M18-17L15 11" stroke="#e1bc77" stroke-width="2"/><ellipse cy="-17" rx="29" ry="5" fill="#80603a" stroke="#d9b26c" stroke-width="3"/><g class="film-basket-leaves" style="opacity:${Number(leafCount) ? 0 : 1}"><path d="M-19-19Q-27-34-10-38Q1-23-13-18M-5-20Q-9-38 6-40Q19-26 4-18M10-18Q8-34 21-35Q31-20 17-16" fill="#cdaa48" stroke="#876d34" stroke-width="1.4"/></g></g>
    <g class="film-wind-lines" data-film-prop="wind" style="opacity:0"><path d="M314 208Q364 184 409 207Q439 220 447 202Q452 190 440 186M360 245Q402 230 440 245L498 244M408 281Q438 270 469 279Q493 288 500 275" fill="none" stroke="#e4f6dc" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
    ${lionArt(id, actors.lion)}${birdArt(id, actors.bird)}<path d="M0 552Q250 537 508 555Q731 535 1000 552V563H0Z" fill="#b6b869" opacity=".16"/>
  </svg></div>`;
}

/** Every timer and Web Animation is owned here and cancelled on exit. */
export function mountFilmStage(element, { reducedMotion = false, paused = false } = {}) {
  const stage = element?.matches?.('.film-stage') ? element : element?.querySelector?.('.film-stage');
  if (!stage) return { playCue: () => Promise.resolve(), setSpeaking() {}, setPaused() {}, update() {}, dispose() {} };
  const doc = stage.ownerDocument;
  const win = doc.defaultView;
  // A global static-art preference completes cues immediately, so awaiting a
  // visual cue cannot stall the director. A task pause remains resumable.
  const baseReducedMotion = Boolean(reducedMotion || win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  reducedMotion = baseReducedMotion || doc.body.dataset.motionPaused === 'true';
  const find = selector => stage.querySelector(selector);
  const actor = name => find(`[data-film-actor="${name}"]`);
  const prop = name => find(`[data-film-prop="${name}"]`);
  const lion = actor('lion');
  const bird = actor('bird');
  const joint = (name, part) => actor(name)?.querySelector(`[data-film-joint="${part}"]`);
  let disposed = false;
  let serial = 0;
  let requestedPause = Boolean(paused);
  const records = new Set();
  const loops = new Map();
  const effectivePause = () => requestedPause || doc.hidden;
  const apply = (node, frame) => {
    if (!node || !frame) return;
    for (const [key, value] of Object.entries(frame)) if (!['offset', 'easing', 'composite'].includes(key)) node.style[key] = value;
  };
  const stopLoop = name => {
    const record = loops.get(name);
    if (!record) return;
    record.animation?.cancel();
    if (record.restore) apply(record.node, record.restore);
    loops.delete(name);
  };
  const loop = (name, node, frames, duration, restore = null) => {
    stopLoop(name);
    if (!node || reducedMotion || disposed) return;
    const record = { node, restore, animation: null };
    if (typeof node.animate === 'function') {
      record.animation = node.animate(frames, { duration, iterations: Infinity, easing: 'ease-in-out' });
      if (effectivePause()) record.animation.pause();
    }
    loops.set(name, record);
  };
  const motion = (node, frames, duration = 700, easing = 'ease-in-out') => {
    if (disposed || !node) return Promise.resolve();
    const final = frames[frames.length - 1];
    if (reducedMotion) { apply(node, final); return Promise.resolve(); }
    return new Promise(resolve => {
      const record = { animation: null, timer: null, remaining: duration, started: 0, done: false, finish: null, resume: null };
      record.finish = (commit = true) => {
        if (record.done) return;
        record.done = true;
        if (record.timer !== null) win.clearTimeout(record.timer);
        if (commit && !disposed) apply(node, final);
        if (record.animation) { record.animation.onfinish = null; record.animation.cancel(); }
        records.delete(record);
        resolve();
      };
      record.resume = () => {
        if (record.done || effectivePause() || record.timer !== null) return;
        if (record.animation) record.animation.play();
        else {
          record.started = Date.now();
          record.timer = win.setTimeout(() => record.finish(), record.remaining);
        }
      };
      records.add(record);
      if (typeof node.animate === 'function') {
        record.animation = node.animate(frames, { duration, easing, fill: 'both' });
        record.animation.onfinish = () => record.finish();
        if (effectivePause()) record.animation.pause();
      } else { apply(node, frames[0]); record.resume(); }
    });
  };
  const move = (node, x, y, duration, scale = 1, arc = 0) => {
    const from = node.style.transform || 'translate(0px, 0px)';
    const frames = [{ transform: from }];
    if (arc) {
      const match = from.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      if (match) frames.push({ transform: position((Number(match[1]) + x) / 2, (Number(match[2]) + y) / 2 - arc, scale), offset: .5 });
    }
    frames.push({ transform: position(x, y, scale) });
    return motion(node, frames, duration);
  };
  const pose = (name, value) => { actor(name).dataset.filmPose = value; };
  const walkLoops = ['walk-left', 'walk-right', 'walk-arm-left', 'walk-arm-right'];
  const flightLoops = ['flight-left', 'flight-right'];
  const walk = async (x, y, duration = 1400, token = serial) => {
    pose('lion', 'walking');
    loop('walk-left', joint('lion', 'left-leg'), [{ transform: 'rotate(-19deg)' }, { transform: 'rotate(18deg)' }, { transform: 'rotate(-19deg)' }], 510, { transform: '' });
    loop('walk-right', joint('lion', 'right-leg'), [{ transform: 'rotate(18deg)' }, { transform: 'rotate(-19deg)' }, { transform: 'rotate(18deg)' }], 510, { transform: '' });
    loop('walk-arm-left', joint('lion', 'left-arm'), [{ transform: 'rotate(14deg)' }, { transform: 'rotate(-15deg)' }, { transform: 'rotate(14deg)' }], 510, { transform: '' });
    loop('walk-arm-right', joint('lion', 'right-arm'), [{ transform: 'rotate(-14deg)' }, { transform: 'rotate(15deg)' }, { transform: 'rotate(-14deg)' }], 510, { transform: '' });
    await move(lion, x, y, duration);
    if (disposed || serial !== token) return;
    walkLoops.forEach(stopLoop);
    pose('lion', 'standing');
  };
  const fly = async (x, y, duration = 1200, token = serial, arc = 35) => {
    pose('bird', 'flying');
    loop('flight-left', joint('bird', 'left-wing'), [{ transform: 'rotate(-35deg) scaleY(.7)' }, { transform: 'rotate(30deg) scaleY(1.3)' }, { transform: 'rotate(-35deg) scaleY(.7)' }], 220, { transform: '' });
    loop('flight-right', joint('bird', 'right-wing'), [{ transform: 'rotate(70deg) scaleY(.8)' }, { transform: 'rotate(-55deg) scaleY(1.3)' }, { transform: 'rotate(70deg) scaleY(.8)' }], 220, { transform: '' });
    await move(bird, x, y, duration, 1, arc);
    if (disposed || serial !== token) return;
    flightLoops.forEach(stopLoop);
    pose('bird', 'perched');
  };
  const alive = token => !disposed && token === serial;
  const blink = name => motion(joint(name, 'eyes'), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)', offset: .45 }, { transform: 'scaleY(1)' }], 220);
  const refreshWheel = () => {
    if (prop('wheel').dataset.filmState === 'running') {
      loop('wheel', find('.film-wheel-rotor'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], 6500);
      loop('stream', find('.film-stream-current'), [{ strokeDashoffset: '0' }, { strokeDashoffset: '-66' }], 1400);
      loop('splash', find('.film-wheel-splash'), [{ opacity: '.5', transform: 'translateY(0px)' }, { opacity: '1', transform: 'translateY(-3px)' }, { opacity: '.5', transform: 'translateY(0px)' }], 580);
    } else ['wheel', 'stream', 'splash'].forEach(stopLoop);
  };
  const finishCue = cue => {
    if (cue === 'open-gate') {
      prop('gate').dataset.filmState = 'open';
      find('.film-gate-panel').style.transform = 'translateY(-42px)';
    }
    if (cue === 'clear-leaves') {
      prop('leaves').dataset.filmState = 'cleared';
      prop('leaves').style.opacity = '0';
      find('.film-basket-leaves').style.opacity = '1';
    }
    if (cue === 'wheel-start') {
      prop('wheel').dataset.filmState = 'running';
      prop('stream').dataset.filmState = 'flowing';
      prop('stream').style.opacity = '.8';
      find('.film-wheel-splash').style.opacity = '1';
      refreshWheel();
    }
    if (cue === 'water-garden') {
      prop('garden-water').dataset.filmState = 'flowing';
      prop('garden-water').style.opacity = '1';
    }
    if (cue === 'flower-grow') {
      prop('plant').dataset.filmState = 'flower';
      find('.film-plant-stem').style.transform = 'scale(1)';
      find('.film-flower-head').style.transform = 'translate(0px,-68px) scale(1)';
      find('.film-flower-head').style.opacity = '1';
    }
  };

  const perform = async (cue, token) => {
    if (cue === 'arrival') {
      lion.style.transform = position(116, 491);
      bird.style.transform = position(139, 338);
      await Promise.all([walk(278, 491, 1800, token), fly(378, 342, 1800, token, 38), motion(joint('lion', 'tail'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(0deg)' }], 1800)]);
      if (alive(token)) await blink('lion');
    } else if (cue === 'wind') {
      await Promise.all([
        motion(prop('wind'), [{ opacity: '0', transform: 'translateX(-80px)' }, { opacity: '1', transform: 'translateX(0px)', offset: .35 }, { opacity: '0', transform: 'translateX(85px)' }], 1750),
        motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)', offset: .4 }, { transform: 'rotate(3deg)' }], 1400),
        motion(joint('lion', 'scarf'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-19deg)' }, { transform: 'rotate(0deg)' }], 1400), fly(496, 316, 1500, token, 20),
        ...Array.from(stage.querySelectorAll('.film-loose-leaf'), (leaf, i) => motion(leaf, [{ transform: 'translate(0px,0px) rotate(0deg)' }, { transform: `translate(${-20 + i * 8}px,${-12 - i * 5}px) rotate(${30 + i * 12}deg)`, offset: .5 }, { transform: 'translate(0px,0px) rotate(0deg)' }], 1700)),
      ]);
    } else if (cue === 'inspect-bird') {
      await Promise.all([walk(542, 479, 1600, token), fly(772, 183, 1800, token, 80)]);
      if (!alive(token)) return;
      pose('bird', 'looking');
      await Promise.all([motion(joint('bird', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(17deg)', offset: .4 }, { transform: 'rotate(9deg)' }], 600), motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)' }], 600), blink('bird')]);
    } else if (cue === 'inspect-lion') {
      await Promise.all([walk(713, 459, 1700, token), fly(813, 188, 1300, token, 40)]);
      if (!alive(token)) return;
      pose('lion', 'examining');
      await Promise.all([motion(joint('lion', 'right-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-112deg)', offset: .55 }, { transform: 'rotate(-102deg)' }], 900), motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-12deg)' }], 900)]);
    } else if (cue === 'open-gate') {
      await Promise.all([walk(663, 445, 1000, token), fly(592, 291, 1100, token, 45)]);
      if (!alive(token)) return;
      pose('lion', 'pulling');
      await motion(joint('lion', 'left-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(67deg)' }], 500);
      if (!alive(token)) return;
      await Promise.all([motion(find('.film-gate-panel'), [{ transform: 'translateY(0px)' }, { transform: 'translateY(-42px)' }], 1050), motion(find('.film-gate-handle'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-42deg)' }], 1050), motion(joint('lion', 'left-arm'), [{ transform: 'rotate(67deg)' }, { transform: 'rotate(92deg)' }], 1050), motion(joint('lion', 'torso'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(0deg)' }], 1050)]);
      if (alive(token)) await motion(joint('lion', 'left-arm'), [{ transform: 'rotate(92deg)' }, { transform: 'rotate(0deg)' }], 450);
    } else if (cue === 'clear-leaves') {
      await Promise.all([walk(640, 445, 900, token), fly(606, 296, 900, token, 20)]);
      if (!alive(token)) return;
      pose('lion', 'gathering');
      await Promise.all([motion(joint('lion', 'left-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(65deg)' }], 450), motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(9deg)' }], 450)]);
      if (!alive(token)) return;
      await Promise.all([motion(prop('leaves'), [{ opacity: '1', transform: 'translate(0px,0px)' }, { opacity: '1', transform: 'translate(61px,-18px)', offset: .55 }, { opacity: '0', transform: 'translate(106px,78px)' }], 1150), motion(joint('lion', 'left-arm'), [{ transform: 'rotate(65deg)' }, { transform: 'rotate(-26deg)' }], 1150), motion(find('.film-basket-leaves'), [{ opacity: '0' }, { opacity: '0', offset: .7 }, { opacity: '1' }], 1150)]);
      if (alive(token)) await motion(joint('lion', 'left-arm'), [{ transform: 'rotate(-26deg)' }, { transform: 'rotate(0deg)' }], 350);
    } else if (cue === 'wheel-start') {
      await Promise.all([motion(find('.film-wheel-rotor'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(18deg)', offset: .22 }, { transform: 'rotate(90deg)', offset: .55 }, { transform: 'rotate(360deg)' }], 2200, 'ease-in'), motion(prop('stream'), [{ opacity: '0' }, { opacity: '.8' }], 1800), motion(find('.film-wheel-splash'), [{ opacity: '0' }, { opacity: '.9' }], 2000), motion(joint('lion', 'right-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-75deg)', offset: .5 }, { transform: 'rotate(-25deg)' }], 1700), fly(726, 222, 1800, token, 45)]);
    } else if (cue === 'water-garden') {
      const { x, y } = gardenGeometry(stage.dataset.filmGarden);
      await Promise.all([walk(x + 110, y + 77, 1750, token), fly(x + 25, y - 70, 1700, token, 75), motion(prop('garden-water'), [{ opacity: '0' }, { opacity: '1' }], 1800)]);
      if (!alive(token)) return;
      pose('lion', 'watering');
      prop('watering-can').style.opacity = '1';
      await Promise.all([motion(joint('lion', 'left-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(48deg)' }], 450), motion(prop('watering-can'), [{ transform: `translate(${x + 62}px,${y + 3}px) rotate(0deg)` }, { transform: `translate(${x + 60}px,${y - 3}px) rotate(-18deg)` }], 450)]);
      if (!alive(token)) return;
      await Promise.all([motion(find('.film-watering-drops'), [{ opacity: '0', transform: 'translateY(-3px)' }, { opacity: '1', transform: 'translateY(6px)', offset: .3 }, { opacity: '0', transform: 'translateY(12px)' }], 1050), motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)' }], 800)]);
    } else if (cue === 'flower-grow') {
      prop('watering-can').style.opacity = '0';
      await Promise.all([motion(prop('sunlight'), [{ opacity: '0' }, { opacity: '.8', offset: .4 }, { opacity: '.25' }], 2600), motion(find('.film-plant-stem'), [{ transform: 'scale(.45)' }, { transform: 'scale(.67)', offset: .4 }, { transform: 'scale(1)' }], 1900), motion(find('.film-flower-head'), [{ opacity: '0', transform: 'translate(0px,-30px) scale(.05)' }, { opacity: '1', transform: 'translate(0px,-56px) scale(.55)', offset: .55 }, { opacity: '1', transform: 'translate(0px,-68px) scale(1)' }], 2500), motion(joint('lion', 'left-arm'), [{ transform: 'rotate(48deg)' }, { transform: 'rotate(0deg)' }], 600), fly(gardenGeometry(stage.dataset.filmGarden).x + 16, 249, 2100, token, 25)]);
      if (alive(token)) { pose('lion', 'delighted'); await blink('lion'); }
    } else if (cue === 'wave') {
      pose('lion', 'waving');
      await Promise.all([motion(joint('lion', 'head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-5deg)' }], 400), motion(joint('lion', 'right-arm'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-142deg)', offset: .22 }, { transform: 'rotate(-117deg)', offset: .42 }, { transform: 'rotate(-151deg)', offset: .62 }, { transform: 'rotate(-119deg)', offset: .8 }, { transform: 'rotate(-140deg)' }], 1900), fly(372, 280, 1900, token, 25)]);
    }
  };

  function setSpeaking(value) {
    if (disposed) return;
    const speaker = ['lion', 'bird', 'narrator'].includes(value) ? value : null;
    stage.dataset.filmSpeaking = speaker || '';
    for (const name of ['lion', 'bird']) {
      const speaking = speaker === name;
      actor(name).dataset.filmSpeaking = String(speaking);
      stopLoop(`mouth-${name}`);
      if (!speaking || reducedMotion) continue;
      if (name === 'lion') loop('mouth-lion', joint('lion', 'mouth'), [{ transform: 'scaleY(.35)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(.5)' }, { transform: 'scaleY(.9)' }, { transform: 'scaleY(.35)' }], 360, { transform: '' });
      else loop('mouth-bird', joint('bird', 'mouth'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(21deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(16deg)' }, { transform: 'rotate(0deg)' }], 320, { transform: '' });
    }
  }
  function syncPause() {
    if (disposed) return;
    const stopped = effectivePause();
    stage.dataset.filmPaused = String(stopped);
    for (const record of records) {
      if (stopped) {
        if (record.animation) record.animation.pause();
        else if (record.timer !== null) {
          win.clearTimeout(record.timer);
          record.timer = null;
          record.remaining = Math.max(0, record.remaining - (Date.now() - record.started));
        }
      } else record.resume();
    }
    for (const record of loops.values()) if (record.animation) stopped ? record.animation.pause() : record.animation.play();
  }
  function setPaused(value) { requestedPause = Boolean(value); syncPause(); }
  function update(props = {}) {
    if (disposed) return;
    for (const name of ['scene', 'garden', 'branch', 'phase', 'ribbon']) if (props[name] !== undefined) stage.dataset[`film${name[0].toUpperCase()}${name.slice(1)}`] = String(props[name]);
    if (props.label !== undefined) {
      stage.setAttribute('aria-label', String(props.label || SCENE_DESCRIPTION));
      prop('label').style.opacity = props.label ? '1' : '0';
      prop('label').querySelector('text').textContent = String(props.label || '');
    }
    if (props.garden !== undefined) {
      const { x, y } = gardenGeometry(props.garden);
      prop('plant').setAttribute('transform', `translate(${x} ${y})`);
      prop('label').setAttribute('transform', `translate(${x + 61} ${y + 2})`);
      prop('watering-can').style.transform = position(x + 60, y + 3);
      for (const path of prop('garden-water').querySelectorAll('path:not(:last-child)')) path.setAttribute('d', `M528 378Q440 384 356 365Q290 351 ${x} ${y}`);
    }
    if (props.gateOpen !== undefined) {
      prop('gate').dataset.filmState = props.gateOpen ? 'open' : 'closed';
      find('.film-gate-panel').style.transform = `translateY(${props.gateOpen ? -42 : 0}px)`;
    }
    if (props.leafCount !== undefined) {
      prop('leaves').dataset.filmState = props.leafCount ? 'blocked' : 'cleared';
      prop('leaves').style.opacity = props.leafCount ? '1' : '0';
      if (props.leafCount) prop('leaves').style.transform = '';
      for (const leaf of stage.querySelectorAll('[data-film-leaf]')) leaf.style.opacity = Number(leaf.dataset.filmLeaf) < Number(props.leafCount) ? '1' : '0';
      find('.film-basket-leaves').style.opacity = Number(props.leafCount) < 4 ? '1' : '0';
    }
    if (props.flowerGrown !== undefined) {
      prop('plant').dataset.filmState = props.flowerGrown ? 'flower' : 'seedling';
      find('.film-plant-stem').style.transform = `scale(${props.flowerGrown ? 1 : .45})`;
      find('.film-flower-head').style.opacity = props.flowerGrown ? '1' : '0';
      find('.film-flower-head').style.transform = `translate(0px,-68px) scale(${props.flowerGrown ? 1 : .05})`;
    }
    if (props.watered !== undefined) {
      prop('garden-water').dataset.filmState = props.watered ? 'flowing' : 'dry';
      prop('garden-water').style.opacity = props.watered ? '1' : '0';
    }
    if (props.millRunning !== undefined) {
      prop('wheel').dataset.filmState = props.millRunning ? 'running' : 'stopped';
      prop('stream').style.opacity = props.millRunning ? '.8' : '0';
      find('.film-wheel-splash').style.opacity = props.millRunning ? '1' : '0';
      refreshWheel();
    }
  }
  async function playCue(cue) {
    if (disposed) return;
    const token = ++serial;
    for (const record of [...records]) record.finish(false);
    for (const name of [...loops.keys()]) if (!['wheel', 'stream', 'splash', 'mouth-lion', 'mouth-bird'].includes(name)) stopLoop(name);
    stage.dataset.filmCue = String(cue);
    stage.dataset.filmAnimating = 'true';
    await perform(cue, token);
    if (!alive(token)) return;
    finishCue(cue);
    stage.dataset.filmAnimating = 'false';
  }
  const motionPreference = new win.MutationObserver(() => {
    if (disposed) return;
    const next = baseReducedMotion || doc.body.dataset.motionPaused === 'true';
    if (next === reducedMotion) return;
    reducedMotion = next;
    stage.dataset.filmReducedMotion = String(next);
    if (next) {
      for (const record of [...records]) record.finish(true);
      for (const name of [...loops.keys()]) stopLoop(name);
    } else {
      refreshWheel();
      setSpeaking(stage.dataset.filmSpeaking || null);
    }
  });
  motionPreference.observe(doc.body, { attributes: true, attributeFilter: ['data-motion-paused'] });
  function dispose() {
    if (disposed) return;
    disposed = true;
    serial++;
    doc.removeEventListener('visibilitychange', syncPause);
    motionPreference.disconnect();
    for (const record of [...records]) record.finish(false);
    for (const name of [...loops.keys()]) stopLoop(name);
    stage.dataset.filmAnimating = 'false';
    stage.dataset.filmSpeaking = '';
    lion.dataset.filmSpeaking = 'false';
    bird.dataset.filmSpeaking = 'false';
  }
  doc.addEventListener('visibilitychange', syncPause);
  stage.dataset.filmReducedMotion = String(Boolean(reducedMotion));
  syncPause();
  refreshWheel();
  return { playCue, setSpeaking, setPaused, update, dispose };
}
