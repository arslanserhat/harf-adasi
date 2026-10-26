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
export const NARRATION_PHRASES = [INTRO, ENDING, ...CHAPTERS.flatMap(chapter => [chapter.caption, chapter.success]), ...DIALOGUES.flatMap(lines => lines.map(line => line[1]))];

const PHASES = new Set(['intro', 'task', 'success', 'complete']);
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
export function getStoryBeat({ index = 0, total = 8, phase = 'task', completed = index } = {}) {
  const safeTotal = bounded(total, 1, 30, 8);
  const safeCompleted = bounded(completed, 0, safeTotal);
  const safeIndex = bounded(index, 0, safeTotal);
  const safePhase = PHASES.has(phase) ? phase : 'task';
  const chapter = safePhase === 'intro' ? 0 : safePhase === 'complete' ? 4
    : Math.min(4, Math.floor(safeIndex * 5 / safeTotal));
  const content = CHAPTERS[chapter];
  const caption = safePhase === 'intro' ? INTRO : safePhase === 'complete' ? ENDING
    : safePhase === 'success' ? content.success : content.caption;
  return { chapter, title: content.title, caption, narration: caption,
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

function cloud(x, y, scale = 1) {
  return `<g class="story-cloud" transform="translate(${x} ${y}) scale(${scale})"><path d="M0 23C-4 11 8 2 20 7 25-7 48-6 55 9 71 1 87 13 82 25Z" fill="#fff" opacity=".82"/></g>`;
}

function tree(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-5 0 0-74 7 0" fill="#9c7867"/><path d="M0-35-19-60m20 8 20-21" fill="none" stroke="#9c7867" stroke-width="5" stroke-linecap="round"/><path d="M-28-53C-52-58-44-90-25-93-38-120-3-139 13-120 40-129 57-98 40-82 54-57 22-36 7-51-4-38-22-39-28-53" fill="#8bc1a1"/><path d="M-26-85c-8-19 13-31 23-24" fill="none" stroke="#b5d8b4" stroke-width="10" stroke-linecap="round"/></g>`;
}

function envelope(x, y, scale = 1, className = '') {
  return `<g class="${className}" transform="translate(${x} ${y}) scale(${scale})"><rect x="-29" y="-20" width="58" height="40" rx="7" fill="#fff7dc" stroke="#bda47b" stroke-width="2.5"/><path d="m-27-16 27 20 27-20M-27 17l18-15m36 15L9 2" fill="none" stroke="#d5b990" stroke-width="2.3" stroke-linejoin="round"/><circle cx="0" cy="3" r="6" fill="#c798c7"/></g>`;
}

function mailbox(x, y, filled = false) {
  return `<g class="story-mailbox" transform="translate(${x} ${y})"><path d="M-4 0V-72" stroke="#b18461" stroke-width="11"/><path d="M-37-72v-43a30 30 0 0 1 60 0v43Z" fill="#a99ace" stroke="#7564a4" stroke-width="3"/><path d="M20-72H55v-42a29 29 0 0 0-29-30H-7a30 30 0 0 1 30 30v42Z" fill="#c5b5e2" stroke="#7564a4" stroke-width="3"/><path d="M-23-96H9" stroke="#6f6199" stroke-width="5" stroke-linecap="round"/><path class="story-mailbox-flag" d="M42-105v-44h23v17H44" fill="#e7ab80" stroke="#a66d5b" stroke-width="3"/>${filled ? envelope(-8, -102, .52, 'story-letter-arrived') : ''}</g>`;
}

function lion(x, y, complete) {
  return `<g class="story-hero-position" style="--story-hero-x:${x}px;--story-hero-y:${y}px"><ellipse cx="0" cy="5" rx="35" ry="8" fill="#6b765c" opacity=".16"/><g class="story-hero-bounce"><path class="story-lion-tail" d="M22-28q39 12 35-18" fill="none" stroke="#ddaa66" stroke-width="10" stroke-linecap="round"/><path class="story-lion-tail-tip" d="M57-54c-13-7-18 8-8 16 12 7 20-7 8-16" fill="#ba8260"/><g class="story-lion-leg story-lion-leg-back"><path d="M17-27 22 0" stroke="#d6a262" stroke-width="15" stroke-linecap="round"/><path d="M14 2h22" stroke="#8d78b7" stroke-width="12" stroke-linecap="round"/></g><g class="story-lion-leg story-lion-leg-front"><path d="M-17-27-21 0" stroke="#e8b775" stroke-width="15" stroke-linecap="round"/><path d="M-32 2h22" stroke="#9b88c0" stroke-width="12" stroke-linecap="round"/></g><path d="M-25-60q-9 21 0 40 24 14 49-1 9-22-3-41" fill="#f4ca86" stroke="#d3a168" stroke-width="2"/><path d="M-18-44 15-21 31-42" fill="none" stroke="#aa805e" stroke-width="7"/><path d="M17-25v28h28v-29Z" fill="#d7ad7c" stroke="#ad835d" stroke-width="2"/><path d="M17-19h28m-18-8v-4q4-6 10 0v4" fill="none" stroke="#ad835d" stroke-width="2"/><g class="story-lion-arm"><path d="M-21-47-42-32" stroke="#f5ce8d" stroke-width="14" stroke-linecap="round"/><circle cx="-43" cy="-31" r="8" fill="#ffe0a9"/></g><g class="story-lion-head"><path d="M-37-68c-16-8-12-25 1-29-7-17 9-31 23-25 9-15 28-13 34 1 19-6 33 11 25 26 17 10 13 29-3 34-1 18-22 25-34 13-17 11-35 1-34-14Z" fill="#cd9465" stroke="#b78059" stroke-width="2"/><circle cx="-27" cy="-105" r="11" fill="#edbd7e"/><circle cx="27" cy="-105" r="11" fill="#edbd7e"/><circle cx="0" cy="-87" r="34" fill="#ffdb99"/><ellipse cx="0" cy="-73" rx="20" ry="16" fill="#fff0cb"/><g class="story-lion-eyes"><ellipse cx="-13" cy="-91" rx="4" ry="5.5" fill="#5e4c46"/><ellipse cx="13" cy="-91" rx="4" ry="5.5" fill="#5e4c46"/><circle cx="-12" cy="-93" r="1.4" fill="white"/><circle cx="14" cy="-93" r="1.4" fill="white"/></g><ellipse cx="-23" cy="-79" rx="6" ry="3.5" fill="#efa992"/><ellipse cx="23" cy="-79" rx="6" ry="3.5" fill="#efa992"/><path d="M-6-79q6-4 12 0l-6 7Z" fill="#8b6655"/><path class="story-lion-mouth" d="M0-72v4m-9-1q9 10 18 0" fill="none" stroke="#8b6655" stroke-width="2.5" stroke-linecap="round"/><path d="M-29-117q27-25 56-1l-5 5-51-1Z" fill="#a59bcf" stroke="#7e71b0" stroke-width="2"/><path d="M-2-121 4-139" stroke="#aa805e" stroke-width="2"/><path d="M1-134q14-17 23-1-10 10-23 1" fill="#9cc9b3"/><path d="m-20-55 19 13 20-13-11-4-9 5-9-5Z" fill="#83bcae"/></g>${complete ? '<path class="story-hero-wave" d="m22-48 21-18 6-9" fill="none" stroke="#f5ce8d" stroke-width="14" stroke-linecap="round"/>' : ''}</g></g>`;
}

function bird(x, y) {
  return `<g class="story-bird-position" transform="translate(${x} ${y})"><g class="story-bird"><path d="m-18 1-16 5 14 9" fill="#79a6ac"/><ellipse cx="0" cy="4" rx="21" ry="17" fill="#97c7c0"/><circle cx="13" cy="-5" r="15" fill="#aad6ca"/><path class="story-bird-wing" d="M-13 4q8-20 21-4-4 18-21 4" fill="#77afa9"/><path d="m25-5 13 6-13 4Z" fill="#e2ae6d"/><circle cx="18" cy="-8" r="2.8" fill="#485b61"/><path d="m-3 18-2 8m13-9v8" stroke="#a18166" stroke-width="2.5" stroke-linecap="round"/></g></g>`;
}

function flowers(x, y, grown = true) {
  return `<g class="story-planter${grown ? ' is-grown' : ''}" transform="translate(${x} ${y})"><path d="m-48-3 8 36h79l9-36" fill="#d2a182" stroke="#b58569" stroke-width="2.5"/><path d="M-51-7H51v11H-51Z" fill="#e3b592" stroke="#b58569" stroke-width="2.5"/><g class="story-sprouts"><path d="M-27-9v-32m27 32v-46m27 46v-29" stroke="#699d79" stroke-width="5" stroke-linecap="round"/><path d="M-28-25q-22-1-17-15 19-4 17 15m1-9q17-17 23-2-4 15-23 2M0-28q-22-6-17-21 19-3 17 21m1-15q15-18 22-3-3 15-22 3m26 21q-4-20 12-23 14 12-12 23" fill="#8fbd8a"/><g class="story-flower"><circle cx="0" cy="-57" r="12" fill="#d9b2ce"/><circle cx="0" cy="-57" r="5" fill="#f5d69b"/></g></g></g>`;
}

function bridge(chapter, completed, total) {
  const full = chapter >= 3;
  const count = full ? 7 : chapter === 2 ? Math.max(2, Math.min(6, Math.floor(completed / total * 7))) : 2;
  return `<g class="story-bridge"><path d="M456 275q40-64 87 0t92 0" fill="none" stroke="#9bd1d1" stroke-width="47"/><path d="M447 243 635 243M447 220 635 220" stroke="#ae8d71" stroke-width="4"/><path d="M448 211v48m187-48v48" stroke="#9e7d60" stroke-width="8" stroke-linecap="round"/>${Array.from({ length: 7 }, (_, index) => `<rect class="story-bridge-plank${index < count ? ' is-built' : ''}" x="${451 + index * 26}" y="242" width="23" height="10" rx="3" fill="${index < count ? '#d6b28b' : '#e1e8db'}" stroke="${index < count ? '#b59171' : '#c1cec2'}" stroke-width="2" opacity="${index < count ? 1 : .45}"/>`).join('')}</g>`;
}

function props(chapter, completed, total, phase) {
  if (chapter === 0) return `${mailbox(175, 269)}${envelope(349, 159, .8, 'story-drifting-letter')}${envelope(425, 208, .55, 'story-drifting-letter story-drifting-letter-second')}<path d="M363 144q50-42 84-4" fill="none" stroke="#e5eff2" stroke-width="3" stroke-dasharray="5 8"/>`;
  if (chapter === 1) return `<g transform="translate(509 254)"><path d="M-91-1h182v11H-91Z" fill="#c19b7a" stroke="#9c7b65" stroke-width="3"/><path d="M-71 11v29M70 11v29" stroke="#a68368" stroke-width="9" stroke-linecap="round"/><rect x="-74" y="-52" width="51" height="45" rx="7" fill="#fff1c7" stroke="#cebb91" stroke-width="2"/><rect x="-13" y="-59" width="51" height="52" rx="7" fill="#e6daf5" stroke="#b7a7d3" stroke-width="2"/><rect x="48" y="-43" width="29" height="36" rx="5" fill="#dbebdc" stroke="#a8c7b5" stroke-width="2"/><path d="M-63-29h28m35-6h25m30 14h14" stroke="#c4b49b" stroke-width="4" stroke-linecap="round"/></g><g transform="translate(709 211)"><path d="M0-63v104" stroke="#a98467" stroke-width="8"/><path d="m-43-65 71 0 19 19-19 19h-71Z" fill="#ffedb7" stroke="#b89b71" stroke-width="3"/><path d="M-26-46H22m-7-8 9 8-9 8" fill="none" stroke="#a7885e" stroke-width="3" stroke-linecap="round"/></g>`;
  if (chapter === 2) return `${bridge(chapter, completed, total)}<g transform="translate(728 241)"><rect x="-33" y="-30" width="66" height="46" rx="7" fill="#d1b18f" stroke="#ab8868" stroke-width="3"/><path d="m-31-27 63 41m0-41-63 41" stroke="#b99777" stroke-width="3"/></g>${envelope(728, 201, .6, phase === 'success' ? 'story-delivery-letter' : '')}`;
  if (chapter === 3) return `${flowers(552, 230, completed / total > .6)}${flowers(735, 246, completed / total > .7)}<g transform="translate(680 165)"><path d="M-66 61V-11L0-54l66 43v72Z" fill="#e6efdb" stroke="#92b7a0" stroke-width="4"/><path d="M-66-11 0-54 66-11M0-54v115m-66-72H66m-66 29H66" fill="none" stroke="#a8c6b0" stroke-width="3"/><path d="M-20 61V25q20-16 40 0v36" fill="#f9f7df" stroke="#a8c6b0" stroke-width="3"/></g>`;
  return `${mailbox(732, 263, phase === 'complete' || phase === 'success')}${flowers(558, 244, true)}${envelope(619, 164, .9, phase === 'complete' || phase === 'success' ? 'story-sending-letter' : 'story-ready-letter')}`;
}

export function renderStoryScene(options = {}) {
  const beat = getStoryBeat(options);
  const hiddenWord = typeof options.hiddenWord === 'string' ? options.hiddenWord : '';
  const title = withoutTarget(beat.title, hiddenWord);
  const caption = withoutTarget(beat.caption, hiddenWord);
  const id = `harf-story-${++serial}`;
  const progress = beat.phase === 'complete' ? 1 : beat.completed / beat.total;
  const heroX = beat.phase === 'intro' ? 300 : [300, 319, 373 + Math.min(120, progress * 150), 385, 396][beat.chapter];
  const heroY = 264;
  const chapterMarkers = CHAPTERS.map((chapter, index) => `<span class="story-route-stop${index <= beat.chapter ? ' is-reached' : ''}${index === beat.chapter ? ' is-current' : ''}" aria-hidden="true"><span>${index + 1}</span></span>`).join('');
  return `<section class="story-scene" data-story-chapter="${beat.chapter}" data-story-completed="${beat.completed}" data-story-phase="${beat.phase}" data-story-paused="${motionPaused}" data-story-speaking="false" data-story-hidden-word="${escape(hiddenWord)}" data-story-narration="${escape(beat.narration)}" aria-labelledby="${id}-title">
    <div class="story-scene-topline"><span class="story-scene-series">${escape(withoutTarget(STORY_TITLE, hiddenWord))}</span><span class="story-scene-chapter">${beat.chapter + 1} / ${CHAPTERS.length} sahne</span></div>
    <div class="story-scene-stage">
      <svg class="story-scene-art" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="${id}-art-title"><title id="${id}-art-title">${escape(title)}: Alparslan ve kuş arkadaşı mektup yolunda.</title><defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e6e8fa"/><stop offset="1" stop-color="#d9f0ec"/></linearGradient><linearGradient id="${id}-ground" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c7dcba"/><stop offset="1" stop-color="#b3cdaa"/></linearGradient></defs><rect width="960" height="300" fill="url(#${id}-sky)"/><circle cx="825" cy="55" r="29" fill="#fff1bf"/><circle cx="825" cy="55" r="42" fill="#fff1bf" opacity=".28"/>${cloud(74, 48, .9)}${cloud(375, 30, .68)}${cloud(661, 80, .72)}<path d="M0 191q149-84 326 0 148-76 306-4 175-71 328-1v114H0Z" fill="#dce6ce"/><path d="M0 234q190-88 388-7 165-61 328-5 125-40 244-2v80H0Z" fill="url(#${id}-ground)"/><path d="M0 289q225-72 420-25t540-8" fill="none" stroke="#f5e8c7" stroke-width="31"/><path d="M0 289q225-72 420-25t540-8" fill="none" stroke="#efe0b8" stroke-width="2" stroke-dasharray="4 15"/>${tree(84, 239, .9)}${tree(891, 252, .84)}${props(beat.chapter, beat.completed, beat.total, beat.phase)}${bird(beat.chapter >= 3 ? 790 : 197, beat.chapter === 0 ? 119 : 151)}${lion(heroX, heroY, beat.phase === 'success' || beat.phase === 'complete')}<g class="story-ground-details" fill="#9bbd91"><path d="m125 276 4-9 3 9m667 12 3-9 4 9m-622 2 3-7 3 7m659-31 3-9 3 9"/></g></svg>
      <div class="story-scene-tools"><button type="button" data-story-action="listen" aria-label="Hikâyenin bu bölümünü dinle">${icon('listen')}<span>Hikâyeyi dinle</span></button><button type="button" data-story-action="help" aria-label="Alparslan’dan görev için yardım al">${icon('help')}<span>Alparslan’a sor</span></button><button type="button" class="story-motion-control" data-story-action="motion" aria-label="${motionPaused ? 'Hareketi sürdür' : 'Hareketi duraklat'}" aria-pressed="${motionPaused}">${icon(motionPaused ? 'play' : 'pause')}</button></div>
    </div>
    <div class="story-scene-dialogue"><div class="story-speaker-mark" aria-hidden="true">A</div><div><h2 id="${id}-title">${escape(title)}</h2><p class="story-scene-caption">${escape(caption)}</p></div><div class="story-route" aria-label="Hikâye ${beat.chapter + 1}. sahnede">${chapterMarkers}</div></div>
    <button type="button" class="story-dialogue-next" data-story-action="dialogue">Pırpır ve Alparslan’ı dinleyelim →</button>
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
      const lines = DIALOGUES[chapter];
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
  return () => { alive = false; speechId++; container.removeEventListener('click', handler); };
}
