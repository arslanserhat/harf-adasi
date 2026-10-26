import { QUEST_KINDS, getQuestSummaries } from './quest-model.js';
import './quest-home.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const STORIES = {
  letters: { place: 'FENER KIYISI', actions: ['İşareti bul', 'Kendin yaz', 'Yolu aydınlat'], invitation: 'Fenerin kayıp tabelalarını birlikte onaralım.', prop: 'beacon' },
  syllables: { place: 'ORMAN İSTASYONU', actions: ['Vagonu bağla', 'Yükü ulaştır', 'Yeniden hatırla'], invitation: 'Heceleri vagonlara yerleştir; trenini yola çıkar.', prop: 'train' },
  words: { place: 'ADA PAZARI', actions: ['Siparişi bul', 'Etiketini kur', 'Paketi teslim et'], invitation: 'Harf kasalarından bir sipariş hazırlayalım.', prop: 'parcel' },
  reading: { place: 'FISILTI ORMANI', actions: ['İpucunu oku', 'İzini bul', 'Yolu keşfet'], invitation: 'Kelimelerin anlattığı izleri takip edip yolu bul.', prop: 'fireflies' },
  sentences: { place: 'MEKTUP LİMANI', actions: ['Mesajı kur', 'Adresi bul', 'Mektubu ulaştır'], invitation: 'Kelimeleri bir mesaja dönüştür, arkadaşına gönder.', prop: 'letter' },
  numbers: { place: 'ŞENLİK BAHÇESİ', actions: ['Topla ve say', 'Sepeti hazırla', 'Eksikleri tamamla'], invitation: 'Sepetleri sayarak doldur; bahçenin şenliğini kur.', prop: 'sprout' },
};

const PRACTICE = [
  ['letters', 'Harfleri çalış'], ['syllables', 'Heceleri çalış'], ['words', 'Kelimeleri çalış'],
  ['reading', 'Oku ve bul'], ['sentences', 'Cümleleri çalış'], ['numbers', 'Sayıları çalış'],
];
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

function worldProp(name) {
  const props = {
    beacon: '<span class="quest-portal-beam"></span><span class="quest-portal-lamp"></span>',
    train: '<svg viewBox="0 0 180 58" aria-hidden="true"><path d="M6 43h168" stroke="#b1a17a" stroke-width="3"/><path d="M8 31h34V13H29v18H8z" fill="#307f75" stroke="#fff0d0" stroke-width="2"/><path d="M10 30V15h12v15m10-17V5h8v8" fill="#e1a158"/><path d="M48 25h35v16H48zm43 0h35v16H91zm43 0h35v16h-35z" fill="#e6b66f" stroke="#fff0d0" stroke-width="2"/><path d="M42 37h6m35 0h8m35 0h8" stroke="#70593a" stroke-width="3"/><g fill="#435c4b" stroke="#f9e6bd" stroke-width="2"><circle cx="17" cy="43" r="7"/><circle cx="36" cy="43" r="7"/><circle cx="57" cy="43" r="6"/><circle cx="75" cy="43" r="6"/><circle cx="100" cy="43" r="6"/><circle cx="118" cy="43" r="6"/><circle cx="143" cy="43" r="6"/><circle cx="161" cy="43" r="6"/></g></svg>',
    parcel: '<svg viewBox="0 0 62 62" aria-hidden="true"><path d="m9 20 22-9 22 9v30L31 59 9 50z" fill="#d6a265" stroke="#fff2cf" stroke-width="2"/><path d="m9 20 22 9 22-9M31 29v30M20 16l22 9v13" fill="none" stroke="#f7d69a" stroke-width="5"/><path d="m16 36 9 4v8l-9-4z" fill="#fff5d8"/></svg>',
    fireflies: '<span></span><span></span><span></span>',
    letter: '<svg viewBox="0 0 66 49" aria-hidden="true"><rect x="3" y="3" width="60" height="43" rx="6" fill="#fff2cf" stroke="#d1a667" stroke-width="2"/><path d="m5 7 28 21L61 7M5 42l20-18m36 18L41 24" fill="none" stroke="#d5b47f" stroke-width="2"/><circle cx="33" cy="29" r="7" fill="#c99386"/></svg>',
    sprout: '<svg viewBox="0 0 61 65" aria-hidden="true"><path d="M30 59V27" fill="none" stroke="#739253" stroke-width="5" stroke-linecap="round"/><path d="M29 38C10 37 7 27 6 17c15-2 25 4 23 21" fill="#9dba67"/><path d="M32 28C29 9 41 5 54 6c0 16-7 24-22 22" fill="#80a557"/><ellipse cx="30" cy="61" rx="23" ry="3" fill="#657b4926"/></svg>',
  };
  return `<span class="quest-portal-prop quest-portal-${name}" aria-hidden="true">${props[name] || ''}</span>`;
}

function activeIndex(history, kind) {
  const active = history?.active;
  const index = active?.index;
  if ((active?.kind || active?.plan?.kind) !== kind || !Number.isInteger(index)
    || index < 0 || index > 5 || active?.plan?.stages?.length !== 6) return null;
  return index;
}

/** Destinations only render saved actions; animations never create progress. */
export function renderQuestDestinations({ assetBase = './', history = null } = {}) {
  const base = String(assetBase).replace(/\/?$/, '/');
  const summaries = new Map(getQuestSummaries(history).map(summary => [summary.kind || summary.id, summary]));
  return `<section class="games quest-destinations" aria-labelledby="questDestinationsTitle">
    <div class="home-section-heading quest-map-heading"><div><span class="home-eyebrow">ADANIN MACERA HARİTASI</span><h2 id="questDestinationsTitle">Bugün hangi dünyaya gidelim?</h2></div><p>Her dünyanın bir işi, her işin bir hikâyesi var.</p></div>
    <div class="quest-map-intro"><span class="quest-map-path" aria-hidden="true"><i></i><i></i><i></i></span><p>Yükünü hazırla, bir yolu aç, bir arkadaşına yardım et.<br><strong>Küçük işlerin sonunda adada bir şey değişsin.</strong></p><span class="quest-map-stops">6 dünya · Her birinde 6 durak</span></div>
    <div class="quest-portal-grid">${QUEST_KINDS.map((meta, index) => {
      const story = STORIES[meta.id];
      const completedCount = summaries.get(meta.id)?.completedCount || 0;
      const currentIndex = activeIndex(history, meta.id);
      const resumed = currentIndex !== null;
      const filled = resumed ? currentIndex : completedCount ? 6 : 0;
      const status = resumed ? `${currentIndex + 1}. duraktan devam` : completedCount ? `${completedCount} macera tamamlandı` : 'İlk maceran seni bekliyor';
      return `<button type="button" class="quest-world-portal quest-world-${meta.id}${resumed ? ' is-resuming' : ''}" data-do="quest-start" data-quest-kind="${meta.id}" aria-label="${escape(meta.title)}: ${escape(story.invitation)} ${escape(status)}">
        <span class="quest-portal-picture"><img src="${escape(base)}art/quest-${meta.id}.webp" width="640" height="384" alt="" loading="lazy" decoding="async" draggable="false"><span class="quest-portal-shade"></span><span class="quest-portal-place">${story.place}</span><span class="quest-portal-number">${String(index + 1).padStart(2, '0')}</span>${worldProp(story.prop)}<span class="quest-portal-path" aria-hidden="true"></span></span>
        <span class="quest-portal-copy"><strong>${escape(meta.title)}</strong><span class="quest-portal-description">${story.invitation}</span><span class="quest-portal-actions">${story.actions.map(action => `<span>${action}</span>`).join('')}</span><span class="quest-portal-bottom"><span class="quest-portal-status"><span class="quest-portal-dots" aria-hidden="true">${Array.from({ length: 6 }, (_, step) => `<i${step < filled ? ' class="is-complete"' : resumed && step === currentIndex ? ' class="is-current"' : ''}></i>`).join('')}</span><span>${escape(status)}</span></span><span class="quest-portal-enter">${resumed ? 'Devam et' : completedCount ? 'Yeni macera' : 'Keşfe çık'}${arrow}</span></span></span>
      </button>`;
    }).join('')}</div>
    <section class="quest-practice-library" aria-labelledby="questPracticeTitle"><div><span class="quest-practice-label">İSTERSEK AYRICA ÇALIŞALIM</span><h3 id="questPracticeTitle">Serbest alıştırmalar</h3><p>Bir harfi ya da kelimeyi seçip kendi hızında tekrar edebilirsin.</p></div><div class="quest-practice-links">${PRACTICE.map(([id, label]) => `<button type="button" data-do="catalog" data-view="${id}"><span>${label}</span>${arrow}</button>`).join('')}</div></section>
  </section>`;
}
