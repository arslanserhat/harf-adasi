import './quests.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const BASE = typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || '/');
const asset = name => `${BASE.endsWith('/') ? BASE : `${BASE}/`}${name}`;

const WORLDS = {
  letters: { place: 'Işık Koyu', caption: 'Tabelayı onaralım, fenerin yolu açılsın.', animal: 'lion', object: 'tabela', art: 'quest-letters.webp' },
  syllables: { place: 'Çiçek İstasyonu', caption: 'Her vagon bir parça. Birlikte yola çıkıyoruz.', animal: 'rabbit', object: 'teslimat', art: 'quest-syllables.webp' },
  words: { place: 'Ada Pazarı', caption: 'Etiketleri hazırlayalım, paketler dostlarına ulaşsın.', animal: 'fox', object: 'paket', art: 'quest-words.webp' },
  reading: { place: 'Fısıltı Ormanı', caption: 'Bir ipucu, yeni bir yol. Dikkatle keşfedelim.', animal: 'squirrel', object: 'ipucu', art: 'quest-reading.webp' },
  sentences: { place: 'Mektup Sokağı', caption: 'Kelimeler bir araya gelince bir mesaj taşır.', animal: 'lion', object: 'mektup', art: 'quest-sentences.webp' },
  numbers: { place: 'Şenlik Bahçesi', caption: 'Topladıklarımızla bahçeyi birlikte hazırlayalım.', animal: 'turtle', object: 'hazırlık', art: 'quest-numbers.webp' },
};

const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const seal = () => `<span class="quest-world-seal" aria-hidden="true">${check}</span>`;
const sprite = animal => `<span class="quest-character quest-character-${animal}" aria-hidden="true" style="--quest-character-image:url('${escape(asset(`art/pet-${animal}.webp`))}')"><span></span></span>`;
const bird = () => `<span class="quest-pirpir" aria-hidden="true" style="--quest-bird-image:url('${escape(asset('art/pirpir-flight.webp'))}')"></span>`;
const illustration = name => `<img src="${escape(asset(`illustrations/${name}_3d.png`))}" alt="" draggable="false" aria-hidden="true">`;
const postbox = '<svg viewBox="0 0 100 120" fill="none" aria-hidden="true"><ellipse cx="51" cy="112" rx="39" ry="7" fill="#35482d25"/><path d="M42 69h16v39H42z" fill="#a87a4e"/><path d="M46 72h5v36h-5z" fill="#d1a26b"/><path d="M12 40c0-31 71-31 71 0v42H12V40Z" fill="#c9503b" stroke="#934b31" stroke-width="4"/><path d="M20 42c0-22 54-23 54 0v31H20V42Z" fill="#e77b50"/><rect x="24" y="35" width="46" height="8" rx="4" fill="#7b4533"/><path d="m37 58 11 8 11-8m-22 0h22v16H37V58Z" fill="#fff0c1" stroke="#c6a26b" stroke-width="2"/><path d="M80 40h8V17h-8v23Z" fill="#b08955"/><path d="M86 18h10v12H86" fill="#f5ce78" stroke="#b08955" stroke-width="2"/><path d="M28 25c10-5 24-7 33-3" stroke="#f5a073" stroke-width="5" stroke-linecap="round"/></svg>';

function countFinished(progress) {
  return Array.isArray(progress.completedStages) ? progress.completedStages.length
    : Number.isFinite(Number(progress.completedStages)) ? Math.max(0, Number(progress.completedStages))
      : Math.max(0, Number(progress.index) || 0);
}

function physicalWorld(kind, stage, progress, done) {
  const tokens = (Array.isArray(progress.selected) ? progress.selected : []).map(token => typeof token === 'string' ? token : token?.text || '').slice(0, 8);
  if (kind === 'syllables') {
    const wagons = tokens.length ? tokens : Array.from({ length: Math.min(4, Math.floor(done / 2)) }, () => '');
    return `<div class="quest-rail" aria-hidden="true"></div><div class="quest-train${progress.correct && ['deliver', 'route'].includes(stage.mechanic) ? ' is-departing' : ''}" aria-hidden="true"><span class="quest-engine">${illustration('locomotive')}</span>${wagons.map(token => `<span class="quest-wagon"><b>${escape(token)}</b><i></i><i></i></span>`).join('')}</div><div class="quest-station-lamp" aria-hidden="true"><i></i><span></span></div>`;
  }
  if (kind === 'letters') return `<div class="quest-lighthouse-beam${done >= 5 ? ' is-lit' : ''}" aria-hidden="true"></div><div class="quest-signpost" aria-hidden="true"><span>${progress.correct && stage.word?.length === 1 ? escape(stage.word) : ' '}</span><i></i>${Array.from({ length: Math.min(3, done) }, () => seal()).join('')}</div>`;
  if (kind === 'words') return `<div class="quest-parcel-shelf" aria-hidden="true">${Array.from({ length: Math.min(4, Math.floor(done / 2)) }, (_, index) => `<span class="quest-delivered-parcel" style="--parcel-index:${index}"><i></i>${seal()}</span>`).join('')}</div>`;
  if (kind === 'sentences') return `<div class="quest-mail-route" aria-hidden="true"><span class="quest-letter${progress.correct && stage.mechanic === 'deliver' ? ' is-delivering' : ''}"><i></i>${done > 1 ? seal() : ''}</span><span class="quest-postbox">${postbox}</span></div>`;
  if (kind === 'reading') return `<div class="quest-forest-path" aria-hidden="true">${Array.from({ length: 6 }, (_, index) => `<span class="${index < done ? 'is-discovered' : ''}" style="--path-index:${index}">${index < done ? check : ''}</span>`).join('')}</div><div class="quest-clue-book" aria-hidden="true">${illustration('open_book')}${done ? seal() : ''}</div>`;
  if (progress.objectsMarkup) return '';
  const quantity = Math.max(0, Math.min(10, Number(progress.quantity) || 0));
  return `<div class="quest-garden-bed" aria-hidden="true">${Array.from({ length: quantity }, (_, index) => `<span class="quest-planted-seed" style="--seed-index:${index}">${illustration('seedling')}</span>`).join('')}</div>`;
}

/** World props only reflect real selections/completed stages; they never reveal an unplayed listening target. */
export function createQuestScene(plan, stage, progress = {}, controlsMarkup = '') {
  const kind = Object.hasOwn(WORLDS, plan.kind) ? plan.kind : 'letters';
  const world = WORLDS[kind];
  const done = countFinished(progress);
  const total = Math.max(1, Number(progress.total) || plan.stages?.length || 6);
  const ratio = Math.min(1, done / total);
  const hasObjects = Boolean(progress.objectsMarkup);
  return `<section class="quest-world${progress.correct ? ' is-success' : ''}${progress.paused ? ' is-paused' : ''}" data-world="${kind}" data-mechanic="${escape(stage.mechanic)}" data-phase="${progress.correct ? 'success' : 'working'}" style="--quest-journey:${ratio}">
    <div class="quest-scene${hasObjects ? ' has-objects' : ''}" aria-label="${escape(world.place)}">
      <img class="quest-backdrop" src="${escape(asset(`art/${plan.art || world.art}`))}" alt="" draggable="false" aria-hidden="true" decoding="async">
      <div class="quest-atmosphere" aria-hidden="true"></div>
      <span class="quest-location">${escape(world.place)}</span>
      <div class="quest-character-route">${sprite(world.animal)}</div>${bird()}
      ${physicalWorld(kind, stage, progress, done)}
      ${progress.objectsMarkup || ''}
      <div class="quest-world-status" aria-label="Dünyadaki ilerlemen"><span>${done} / ${total}</span><b>${escape(world.object)}</b><i style="--quest-progress:${ratio * 100}%"></i></div>
      <p class="quest-world-caption">${escape(world.caption)}</p>
    </div>
    <div class="quest-controls">${controlsMarkup}</div>
  </section>`;
}

export const QUEST_WORLD_ART = Object.fromEntries(Object.entries(WORLDS).map(([kind, world]) => [kind, world.art]));
