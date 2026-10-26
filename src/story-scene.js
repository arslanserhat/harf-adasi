import './story-scene.css';

// Original Harf Adası artwork and story. A scene is a view of completed work;
// it never changes a lesson, checks an answer, or awards learning credit.
export const STORY_TITLE = 'Alparslan ve Kayıp Bahçe Mektubu';

const CHAPTERS = [
  {
    title: 'Rüzgârın dağıttığı mektup',
    caption: 'Bahçenin mektup kartları rüzgârla dağılmış. Alparslan ilk kartı bulmak için seni bekliyor.',
    success: 'İlk kartlardan biri hazır. Alparslan onu mektup çantasına koydu.',
  },
  {
    title: 'Yol etiketi atölyesi',
    caption: 'Bulduğumuz kartlardan bir yol etiketi hazırlayalım. Parçalar birleşince yolumuz da belirginleşecek.',
    success: 'Bir etiket daha hazır. Alparslan yol işaretini yerine taktı.',
  },
  {
    title: 'Derenin eksik köprüsü',
    caption: 'Köprünün birkaç tahtası eksik. Hazırladığın kartlar geldikçe geçidi birlikte tamamlayacağız.',
    success: 'Bir köprü tahtası daha yerine geldi. Bahçeye bir adım daha yaklaştık.',
  },
  {
    title: 'Bahçenin küçük siparişi',
    caption: 'Bahçeye ulaştık. Şimdi buradaki sipariş kartlarını hazırlayıp yerlerine ulaştıralım.',
    success: 'Bir sipariş kartı daha yerine ulaştı. Bahçedeki arkadaşımız sana el sallıyor.',
  },
  {
    title: 'Bir cevap mektubu',
    caption: 'Bahçeden bir cevap mektubu gönderelim. Daha önce çalıştığımız kartları yeniden hatırlayalım.',
    success: 'Cevap mektubuna bir kart daha ekledin. Alparslan mektubu göndermeye hazırlanıyor.',
  },
];

const INTRO = 'Rüzgâr, bahçenin mektup kartlarını dağıtmış. Alparslan ile kartları hazırlayalım, köprüden geçelim ve bahçeye bir cevap götürelim.';
const ENDING = 'Bugünkü mektup yolculuğunu tamamladın. Hazırladığın kartlar bahçeye ulaştı. Bir sonraki buluşmada bazılarını yeniden hatırlayacağız.';
const DIALOGUES = [
  [['Pırpır', 'Rüzgâr mektubun kartlarını uçurdu! Bahçedeki arkadaşımıza nasıl haber vereceğiz?'], ['Alparslan', 'Kartları birlikte hazırlayabiliriz. Önce hangi kartı aradığımızı dinleyelim.']],
  [['Alparslan', 'Bu etiketin parçaları karışmış. Birlikte sıraya koyalım.'], ['Pırpır', 'Parçalar birleşince yol tabelamız hazır olacak.']],
  [['Pırpır', 'Köprü henüz tamamlanmamış. Hazırladığımız kartlarla bir tahta daha koyalım.'], ['Alparslan', 'Acelemiz yok. İpucu istersek birlikte yeniden bakabiliriz.']],
  [['Alparslan', 'İşte bahçe! Hazırladığımız kartları doğru yerlere ulaştıralım.'], ['Pırpır', 'Yazını bitirdiğinde bir büyüğünle birlikte kontrol edebilirsin.']],
  [['Pırpır', 'Arkadaşımıza bir cevap mektubu gönderelim.'], ['Alparslan', 'Daha önce çalıştığımız kartları yeniden hatırlayalım.']],
];
const EPISODES = [
  { title: STORY_TITLE, intro: INTRO, ending: ENDING, chapters: CHAPTERS, dialogues: DIALOGUES },
  {
    title: 'Pırpır’ın Bahçe Pazarı',
    intro: 'Bahçede küçük bir pazar kuruluyor. Pırpır sipariş kartlarını toplamış. Alparslan ile etiketleri hazırlayıp köprüden geçelim ve siparişleri yerlerine ulaştıralım.',
    ending: 'Bahçe pazarının siparişleri yerlerine ulaştı. Pırpır sepetleri hazırladı. Bir sonraki yolculukta çalıştığımız kartlardan bazıları yeniden karşımıza çıkacak.',
    chapters: [
      { title: 'Pırpır’ın sipariş çantası', caption: 'Pırpır’ın çantasında yeni sipariş kartları var. Önce sesini dinleyip doğru kartı bulalım.', success: 'Sipariş kartlarından birini ayırdın. Pırpır onu pazar sepetine koydu.' },
      { title: 'Pazarın etiket atölyesi', caption: 'Pazardaki sepetlere etiket gerekiyor. Kartların parçalarını birleştirip etiketleri hazırlayalım.', success: 'Bir pazar etiketi daha hazır. Alparslan onu teslimat çantasına yerleştirdi.' },
      { title: 'Pazara giden köprü', caption: 'Sepetler derenin öbür yanına ulaşmalı. Hatırladığın parçalar köprüdeki boşlukları tamamlayacak.', success: 'Pazar köprüsünde bir geçiş daha hazır. Pırpır sepeti karşı kıyıya taşıyor.' },
      { title: 'Sepetler yerini buluyor', caption: 'Bahçe pazarına geldik. Sipariş kartlarını okuyup uygun sepetleri birlikte hazırlayalım.', success: 'Bir sepetin kartını daha hazırladın. Pazarın teslimat köşesi düzenleniyor.' },
      { title: 'Pazarın teşekkür kartı', caption: 'Pırpır pazardaki arkadaşına bir teşekkür kartı göndermek istiyor. Çalıştığımız kartları yeniden kullanalım.', success: 'Teşekkür kartına bir parça daha ekledin. Pırpır kartını göndermek için sabırsızlanıyor.' },
    ],
    dialogues: [
      [['Pırpır', 'Bugün bahçede pazar var! Sipariş kartlarını birlikte ayırabilir miyiz?'], ['Alparslan', 'Önce siparişin sesini dinleyelim. Doğru kartı sonra bulabiliriz.']],
      [['Alparslan', 'Bu sepetin etiketi henüz hazır değil. Parçaları sırayla yerleştirelim.'], ['Pırpır', 'Etiket bitince onu teslimat çantamda taşıyacağım.']],
      [['Pırpır', 'Sepetim hazır ama köprüde boşluklar var. Hatırladığımız parçalarla bir geçit kuralım.'], ['Alparslan', 'Birlikte yavaşça ilerleyebiliriz. İstersen önce bir ipucuna bakalım.']],
      [['Alparslan', 'Sepetler pazar yerine ulaştı. Şimdi kartları kullanıp teslimatı tamamlayalım.'], ['Pırpır', 'Bir siparişi hazırlarken kelimenin ne anlattığını da düşünelim.']],
      [['Pırpır', 'Pazardaki arkadaşımız bize yardım etti. Ona bir teşekkür kartı hazırlayalım mı?'], ['Alparslan', 'Daha önce karşılaştığımız kartlar bu mesajda yeniden işimize yarayacak.']],
    ],
  },
  {
    title: 'Fener Şenliği',
    intro: 'Adada renkli bir fener şenliği hazırlanıyor. Alparslan ve Pırpır davet kartlarını dağıtacak. İşaretleri hazırlayalım, köprüden geçelim ve bahçedeki buluşmaya katılalım.',
    ending: 'Şenliğin davet kartları hazır ve fenerler yerlerini buldu. Alparslan ile Pırpır bu yolculukta sana eşlik etti. Sonraki buluşmada bazı kartları yeniden hatırlayacağız.',
    chapters: [
      { title: 'Şenliğe bir davet', caption: 'Pırpır fener şenliği için davet kartları getirdi. Hangi kartın istendiğini dinleyerek başlayalım.', success: 'Bir davet kartını daha hazırladın. Pırpır onu şenlik çantasına yerleştirdi.' },
      { title: 'Şenlik tabelası atölyesi', caption: 'Konukların yolu bulması için yeni tabelalar gerekiyor. İşaret kartlarını sırayla birleştirelim.', success: 'Bir yol işareti daha tamamlandı. Alparslan tabelayı şenlik yoluna taşıyor.' },
      { title: 'Fenerlerin köprüsü', caption: 'Fenerler köprüden geçerek bahçeye ulaşacak. Önceden çalıştığımız kartları hatırlayıp geçidi hazırlayalım.', success: 'Fener yolunun bir bölümü daha hazır. Pırpır köprünün öbür ucundan sana sesleniyor.' },
      { title: 'Bahçede renkli buluşma', caption: 'Şenlik bahçesine geldik. Hazırladığımız kartlarla fenerlerin ve davetlerin yerlerini tamamlayalım.', success: 'Şenlik hazırlığına bir katkı daha yaptın. Bahçedeki fenerlerden biri yerine yerleşti.' },
      { title: 'Şenlikten bir haber', caption: 'Bu güzel buluşmadan arkadaşımıza bir mesaj gönderelim. Bildiğimiz kartlarla haberimizi hazırlayalım.', success: 'Şenlik mesajının bir parçası daha hazır. Alparslan cevap mektubunu zarfa yerleştiriyor.' },
    ],
    dialogues: [
      [['Pırpır', 'Fener şenliğine davetliyiz! Bu kartların sesini birlikte dinleyelim.'], ['Alparslan', 'Herkesin yolu bulması için davetleri ve işaretleri hazırlayabiliriz.']],
      [['Alparslan', 'Şenliğin yol tabelası burada hazırlanacak. Parçaları birleştirmeye başlayalım.'], ['Pırpır', 'Tabelayı görünce arkadaşlarımız hangi yoldan gideceklerini anlayacak.']],
      [['Pırpır', 'Fenerleri köprüden birlikte geçirelim. Önce eksik geçidi tamamlamamız gerekiyor.'], ['Alparslan', 'Hatırladığımız kartları kullanalım. Bir yardım istersek örneğe yeniden bakabiliriz.']],
      [['Alparslan', 'Bahçede buluşmaya az kaldı. Şimdi hazırladığımız kartları yerlerine ulaştıralım.'], ['Pırpır', 'Renkli fenerler bizi bekliyor. Hazır olduğunda sıradaki küçük işi sen seçebilirsin.']],
      [['Pırpır', 'Şenlikten bir haber gönderelim. Arkadaşımız hazırlıkları merak ediyor.'], ['Alparslan', 'Mesajımızda daha önce çalıştığımız kartları bir kez daha kullanacağız.']],
    ],
  },
];
export const STORY_EPISODE_COUNT = EPISODES.length;
export const NARRATION_PHRASES = EPISODES.flatMap(episode => [episode.intro, episode.ending,
  ...episode.chapters.flatMap(chapter => [chapter.caption, chapter.success]),
  ...episode.dialogues.flatMap(lines => lines.map(line => line[1]))]);

const PHASES = new Set(['intro', 'task', 'success', 'complete']);
const BASE = typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel'
  ? '/' : (import.meta.env?.BASE_URL || '/');
const ART_BASE = `${BASE.endsWith('/') ? BASE : `${BASE}/`}art/`;
const CHAPTER_ART = ['harf-post.webp', 'harf-workshop.webp', 'harf-bridge.webp', 'harf-garden.webp', 'harf-post.webp'];
let serial = 0;
let motionPaused = false;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const withoutTarget = (text, word) => !word ? text : text.replace(/\p{L}+/gu, token =>
  token.toLocaleLowerCase('tr-TR') === word.toLocaleLowerCase('tr-TR') ? '…' : token);
const bounded = (value, minimum, maximum, fallback = minimum) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
};

/** No target word is accepted here: a story must not reveal a recall answer. */
export function getStoryBeat({ index = 0, total = 8, phase = 'task', completed = index, chapter: chapterOverride, episode = 0 } = {}) {
  const safeTotal = bounded(total, 1, 30, 8);
  const safeCompleted = bounded(completed, 0, safeTotal);
  const safeIndex = bounded(index, 0, safeTotal);
  const safePhase = PHASES.has(phase) ? phase : 'task';
  const safeEpisode = bounded(episode, 0, EPISODES.length - 1);
  const story = EPISODES[safeEpisode];
  const chapter = safePhase === 'intro' ? 0 : safePhase === 'complete' ? 4
    : typeof chapterOverride === 'number' && Number.isFinite(chapterOverride) ? bounded(chapterOverride, 0, 4)
      : Math.min(4, Math.floor(safeIndex * 5 / safeTotal));
  const content = story.chapters[chapter];
  const caption = safePhase === 'intro' ? story.intro : safePhase === 'complete' ? story.ending
    : safePhase === 'success' ? content.success : content.caption;
  return { episode: safeEpisode, series: story.title, chapter, title: content.title, caption, narration: caption,
    completed: safeCompleted, total: safeTotal, phase: safePhase };
}

function icon(name) {
  const paths = {
    listen: '<path d="m11 5-6 4H2v6h3l6 4z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    help: '<path d="M9.2 8a3 3 0 0 1 5.6 1.5c0 2-3 2.5-3 4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
  };
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.help}</svg>`;
}

function envelope(x = 0, y = 0) {
  return `<g transform="translate(${x} ${y})"><rect x="-29" y="-20" width="58" height="40" rx="7" fill="#fff7dc" stroke="#bda47b" stroke-width="2.5"/><path d="m-27-16 27 20 27-20M-27 17l18-15m36 15L9 2" fill="none" stroke="#d5b990" stroke-width="2.3" stroke-linejoin="round"/><circle cx="0" cy="3" r="6" fill="#c798c7"/></g>`;
}

export function renderStoryScene(options = {}) {
  const beat = getStoryBeat(options);
  const hiddenWord = typeof options.hiddenWord === 'string' ? options.hiddenWord : '';
  const title = withoutTarget(beat.title, hiddenWord);
  const caption = withoutTarget(beat.caption, hiddenWord);
  const id = `harf-story-${++serial}`;
  const progress = beat.phase === 'complete' ? 1 : beat.completed / beat.total;
  const pieceTotal = bounded(options.pieceTotal, 1, 24, 7);
  const pieces = options.placedPieces === undefined ? Math.floor(progress * pieceTotal) : bounded(options.placedPieces, 0, pieceTotal);
  const builtPlanks = Math.floor(pieces / pieceTotal * 7);
  const art = beat.phase === 'intro' ? 'harf-island.webp' : CHAPTER_ART[beat.chapter];
  // This slot contains only trusted markup created by the lesson renderer.
  // Parent-supplied words must be escaped by that renderer before reaching it.
  const interaction = typeof options.interactionHtml === 'string' ? options.interactionHtml : '';
  const chapterMarkers = CHAPTERS.map((chapter, index) => `<span class="story-route-stop${index <= beat.chapter ? ' is-reached' : ''}${index === beat.chapter ? ' is-current' : ''}" aria-hidden="true"><span>${index + 1}</span></span>`).join('');
  return `<section class="story-scene story-scene-world" style="--story-growth:${(.4 + progress * .6).toFixed(3)};--story-piece-ratio:${(pieces / pieceTotal).toFixed(3)}" data-story-episode="${beat.episode}" data-story-series="${escape(beat.series)}" data-story-chapter="${beat.chapter}" data-story-completed="${beat.completed}" data-story-pieces="${pieces}" data-story-piece-total="${pieceTotal}" data-story-phase="${beat.phase}" data-story-paused="${motionPaused}" data-story-speaking="false" data-story-hidden-word="${escape(hiddenWord)}" data-story-narration="${escape(beat.narration)}" aria-labelledby="${id}-title">
    <div class="story-scene-stage" aria-label="${escape(title)} oyun sahnesi">
      <img class="story-scene-art story-world-backdrop" src="${ART_BASE}${art}" alt="" draggable="false" decoding="async" fetchpriority="high">
      <div class="story-world-light" aria-hidden="true"></div>
      <div class="story-world-motes" aria-hidden="true">${Array.from({ length: 7 }, (_, index) => `<i style="--mote:${index}"></i>`).join('')}</div>
      ${beat.episode === 2 ? '<div class="story-episode-lanterns" aria-hidden="true"><i></i><i></i><i></i></div>' : ''}
      <div class="story-world-physical-props" aria-hidden="true">
        <div class="story-world-envelope"><svg viewBox="-35 -25 70 50">${envelope(0, 0)}</svg><span class="story-world-envelope-shadow"></span></div>
        <div class="story-world-bridge">${Array.from({ length: 7 }, (_, index) => `<i class="story-world-plank${index < builtPlanks ? ' is-built' : ''}" data-piece="${index}" style="--piece:${index}"></i>`).join('')}</div>
        <div class="story-world-sprout"><i></i><i></i><i></i></div>
        <div class="story-world-water"><i></i><i></i><i></i><i></i></div>
        <div class="story-world-delivery-stamp"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></div>
      </div>
      <div class="story-scene-topline"><span class="story-scene-series">${escape(withoutTarget(beat.series, hiddenWord))}</span><div class="story-route" aria-label="Hikâye ${beat.chapter + 1}. sahnede">${chapterMarkers}</div><span class="story-scene-chapter">${beat.chapter + 1} / ${CHAPTERS.length}</span></div>
      <div class="story-scene-dialogue"><div class="story-speaker-mark" aria-hidden="true">A</div><div class="story-dialogue-copy"><h2 id="${id}-title">${escape(title)}</h2><p class="story-scene-caption">${escape(caption)}</p><button type="button" class="story-dialogue-next" data-story-action="dialogue">Pırpır ve Alparslan’ı dinleyelim →</button></div><button type="button" class="story-dialogue-listen" data-story-action="listen" aria-label="Hikâyenin bu bölümünü dinle">${icon('listen')}</button></div>
      <div class="story-interaction-dock${interaction ? ' has-interaction' : ''}">${interaction}</div>
      <div class="story-scene-tools"><button type="button" data-story-action="help" aria-label="Alparslan’dan görev için yardım al">${icon('help')}<span>Alparslan’a sor</span></button><button type="button" class="story-motion-control" data-story-action="motion" aria-label="${motionPaused ? 'Hareketi sürdür' : 'Hareketi duraklat'}" aria-pressed="${motionPaused}">${icon(motionPaused ? 'play' : 'pause')}</button></div>
    </div>
  </section>`;
}

/** Explicit user actions only. The host records help and owns every advance. */
export function mountStoryScene(container, { onListen = () => {}, onHelp = () => {} } = {}) {
  let alive = true;
  let speechId = 0;
  const dialoguePositions = new WeakMap();
  async function listen(scene) {
    const id = ++speechId;
    scene.dataset.storySpeaking = 'true';
    try { await onListen(scene.dataset.storyNarration || scene.querySelector('.story-scene-caption')?.textContent || ''); }
    catch { /* The host's audio status explains unavailable narration. */ }
    finally { if (alive && id === speechId) scene.dataset.storySpeaking = 'false'; }
  }
  if (!container?.addEventListener) return () => {};
  const updatePieces = scene => {
    const total = bounded(scene.dataset.storyPieceTotal, 1, 24, 7);
    const count = bounded(scene.dataset.storyPieces, 0, total);
    const ratio = count / total;
    scene.style.setProperty('--story-piece-ratio', ratio.toFixed(3));
    scene.querySelectorAll('.story-world-plank').forEach((plank, index) => {
      plank.classList.toggle('is-built', index < Math.floor(ratio * 7));
    });
  };
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(records => {
    for (const record of records) if (record.target?.matches?.('.story-scene')) updatePieces(record.target);
  }) : null;
  observer?.observe(container, { attributes: true, attributeFilter: ['data-story-pieces', 'data-story-piece-total'], subtree: true });
  const handler = event => {
    const button = event.target?.closest?.('[data-story-action]');
    if (!button || !container.contains(button) || button.disabled) return;
    const scene = button.closest('.story-scene');
    if (!scene) return;
    const action = button.dataset.storyAction;
    if (action === 'motion') {
      motionPaused = !motionPaused;
      for (const item of container.querySelectorAll('.story-scene')) item.dataset.storyPaused = String(motionPaused);
      for (const control of container.querySelectorAll('[data-story-action="motion"]')) {
        control.setAttribute('aria-pressed', String(motionPaused));
        control.setAttribute('aria-label', motionPaused ? 'Hareketi sürdür' : 'Hareketi duraklat');
        control.innerHTML = icon(motionPaused ? 'play' : 'pause');
      }
      return;
    }
    if (action === 'listen') {
      void listen(scene);
    } else if (action === 'dialogue') {
      const chapter = bounded(scene.dataset.storyChapter, 0, 4);
      const episode = bounded(scene.dataset.storyEpisode, 0, EPISODES.length - 1);
      const lines = EPISODES[episode].dialogues[chapter];
      const position = dialoguePositions.get(scene) || 0;
      const [speaker, text] = lines[position % lines.length];
      dialoguePositions.set(scene, position + 1);
      scene.querySelector('.story-scene-caption').textContent = withoutTarget(text, scene.dataset.storyHiddenWord);
      const heading = scene.querySelector('.story-scene-dialogue h2');
      if (heading) heading.textContent = `${speaker} söylüyor`;
      scene.dataset.storySpeaker = speaker === 'Pırpır' ? 'bird' : 'lion';
      scene.dataset.storyNarration = text;
      scene.querySelector('.story-speaker-mark').textContent = speaker === 'Pırpır' ? 'P' : 'A';
      button.textContent = position % lines.length ? 'Pırpır’a dön →' : 'Alparslan ne diyor? →';
      void listen(scene);
    } else if (action === 'help') {
      void onHelp();
    }
  };
  container.addEventListener('click', handler);
  return () => { alive = false; speechId++; observer?.disconnect(); container.removeEventListener('click', handler); };
}
