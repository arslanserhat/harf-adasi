import { ISLAND_ZONES, ISLAND_COMPANIONS, getIslandMission, deriveIslandWorld } from './island-model.js';
import { illustration } from './visuals.js';
import './island.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const art = (emoji, label = '') => illustration(emoji, label);
const companions = ISLAND_COMPANIONS;
const placements = { beach: { emoji: '🏝️', label: 'Kumsala' }, garden: { emoji: '🌷', label: 'Bahçeye' }, station: { emoji: '🚂', label: 'İstasyona' } };
const shuffle = values => values.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(entry => entry.value);

function terrain() {
  return `<svg class="island-terrain" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="islandSea" x2="0" y2="1"><stop stop-color="#bfeee7"/><stop offset="1" stop-color="#8ddad8"/></linearGradient><linearGradient id="islandLand" x2=".4" y2="1"><stop stop-color="#d9edac"/><stop offset="1" stop-color="#a5d08e"/></linearGradient></defs><path fill="url(#islandSea)" d="M0 0h1000v620H0z"/><path class="island-shore" d="M89 294C28 194 123 103 276 107 347 7 507 12 598 88 743 60 937 128 938 268 1011 359 914 487 751 494 663 606 491 608 390 548 233 572 78 466 89 294Z"/><path fill="url(#islandLand)" d="M119 291C71 207 151 131 291 138 367 39 510 49 586 116 737 91 904 146 903 277 972 361 884 455 735 465 653 569 505 578 398 520 253 543 110 450 119 291Z"/><path class="island-path" d="M264 300Q436 166 710 247M264 300Q430 523 655 419M710 247Q760 342 655 419"/><path class="island-river" d="M586 116Q517 202 564 286T501 538"/><path class="island-bridge" d="m526 301 69 15m-68-34 76 18"/><path class="island-waves" d="M31 501q21-11 42 0t42 0M814 560q21-11 42 0t42 0M60 68q21-11 42 0t42 0M850 45q21-11 42 0t42 0"/></svg>`;
}

function chest(open = false, opening = false) {
  return `<svg class="island-chest${open ? ' is-open' : ''}${opening ? ' is-opening' : ''}" viewBox="0 0 200 180" aria-hidden="true"><ellipse cx="100" cy="165" rx="83" ry="10" fill="#67553c25"/><g class="island-chest-lid"><path d="M26 81V58C26 8 174 8 174 58v23Z" fill="#bc7b42" stroke="#85502d" stroke-width="7"/><path d="M48 77V45m103 32V45" stroke="#ffd47e" stroke-width="13"/><path d="M27 74h146" stroke="#ffd47e" stroke-width="13"/></g><path d="M24 82h152v73H24Z" fill="#c38b4e" stroke="#85502d" stroke-width="7" stroke-linejoin="round"/><path d="M48 86v66m103-66v66M27 148h147" stroke="#ffda83" stroke-width="13"/><rect x="86" y="80" width="28" height="40" rx="7" fill="#ffe8a4" stroke="#b98a34" stroke-width="3"/><circle cx="100" cy="95" r="5" fill="#976d36"/><path d="M98 99h4v9h-4" fill="#976d36"/></svg>`;
}

export function createIsland({ root, getLetters, getCompleted, speak, stopSpeech = () => {}, celebrate, onComplete, onExit, isMuted = () => false, getContentState, onContentExposure = () => {} }) {
  let current = null;
  let generation = 0;
  let listening = false;
  const timers = new Set();
  const muted = () => typeof isMuted === 'function' ? isMuted() : Boolean(isMuted);
  const button = (action, text, attributes = '', className = '') => `<button type="button" class="island-button ${className}" data-island="${action}" ${attributes}>${text}</button>`;
  const feedback = text => {
    const element = root.querySelector('#islandFeedback');
    if (element) element.textContent = text;
  };
  const later = (callback, delay) => {
    const epoch = generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (epoch === generation) callback();
    }, delay);
    timers.add(timer);
  };
  function reset() {
    generation++;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    stopSpeech();
    current = null;
  }
  function bind() {
    if (listening) return;
    root.addEventListener('click', handleClick);
    listening = true;
  }
  function shell(scene, phase, body) {
    return `<section id="island" class="island-app" data-island-scene="${scene}" data-island-phase="${phase}"${current ? ` data-path-step="${current.pathIndex}"` : ''}><div class="island-toolbar">${button(scene === 'map' ? 'exit' : 'map', scene === 'map' ? '← Oyun bahçesi' : '← Adaya dön', '', 'island-back')}<span>${scene === 'map' ? 'Oynadıkça adan büyür' : 'Acelemiz yok, birlikte oynuyoruz'}</span>${scene === 'map' ? '' : `<div class="island-toolbar-actions">${button('guide', '🔊 Yardım', 'aria-label="Yönergeyi dinle"', 'island-back')}${button('pause', 'Mola ver', '', 'island-back')}</div>`}</div>${body}<p id="islandFeedback" class="island-feedback" role="status" aria-live="polite">${scene === 'map' ? 'Bir yere dokun, birlikte yeni bir şey yapalım.' : 'Hazır olduğunda başlayabilirsin.'}</p></section>`;
  }
  function renderMap() {
    reset();
    bind();
    const world = deriveIslandWorld(getCompleted());
    const rewards = Array.isArray(world.rewards) ? world.rewards : [];
    const garden = rewards.filter(reward => reward.zone === 'treasure' && (!reward.placement || reward.placement === 'garden'));
    const beach = rewards.filter(reward => reward.zone === 'treasure' && reward.placement === 'beach');
    const station = rewards.filter(reward => reward.zone === 'treasure' && reward.placement === 'station');
    root.innerHTML = shell('map', 'map', `<div class="island-heading"><span class="island-kicker">Alparslan ile yap, oyna, keşfet</span><h1>Yaşayan Harf Adası</h1><p>Hayvanlarla ilgilen, trenini yola çıkar, hazineni bul.</p></div><div class="island-world" aria-label="Oynadıkça büyüyen ada">${terrain()}<div class="island-cloud island-cloud-one"></div><div class="island-cloud island-cloud-two"></div><div class="island-world-tree island-world-tree-one" aria-hidden="true">${art('🌳')}</div><div class="island-world-tree island-world-tree-two" aria-hidden="true">${art('🌳')}</div><div class="island-world-flowers" aria-hidden="true">${art('🌷')}${art('🌼')}</div><div class="island-world-home" aria-hidden="true">${art('🏠')}</div>${ISLAND_ZONES.map(zone => {
      const fallback = { care: ['Hayvan dostlarım', 'Birlikte besle ve oyna', '🐈'], train: ['Tren istasyonu', 'Vagonları kur, yola çıkar', '🚂'], treasure: ['Hazine yolu', 'Keşfet, bul, adana yerleştir', '🏝️'] }[zone.id];
      return button('start', `<span class="island-zone-art" aria-hidden="true">${zone.id === 'treasure' ? chest() : art(fallback[2])}</span><strong>${escape(fallback[0])}</strong><small>${escape(fallback[1])}</small><span class="island-zone-badge" data-world-${zone.id}>${world[zone.id] || 0}</span>`, `data-zone="${zone.id}" aria-label="${escape(fallback[0])}: oyuna başla"`, `island-zone island-zone-${zone.id}`);
    }).join('')}<div class="island-world-pets" aria-label="Adadaki hayvan dostları">${rewards.filter(reward => reward.zone === 'care').slice(-4).map(reward => `<span data-world-companion="${escape(reward.companion || '')}" title="${escape(reward.label)}">${art(reward.emoji)}</span>`).join('')}</div><div class="island-world-station${world.train ? ' is-built' : ''}" aria-label="${world.train ? 'Kurduğun tren istasyonu' : 'Tren istasyonunu birlikte kuralım'}">${world.train ? art('🏫') + '<span>İstasyonum</span>' : '<span class="island-station-plan">İstasyon burada büyüyecek</span>'}</div><div class="island-world-garden" aria-label="Bahçedeki hazineler">${garden.slice(-5).map(reward => `<span data-world-placement="${escape(reward.placement || 'garden')}" data-reward-key="${escape(reward.key)}" title="${escape(reward.label)}">${art(reward.emoji)}</span>`).join('')}</div><div class="island-world-beach" aria-label="Kumsaldaki hazineler">${beach.slice(-4).map(reward => `<span data-world-placement="${escape(reward.placement || 'garden')}" data-reward-key="${escape(reward.key)}" title="${escape(reward.label)}">${art(reward.emoji)}</span>`).join('')}</div><div class="island-world-station-prizes" aria-label="İstasyondaki hazineler">${station.slice(-3).map(reward => `<span data-world-placement="${escape(reward.placement || 'garden')}" data-reward-key="${escape(reward.key)}" title="${escape(reward.label)}">${art(reward.emoji)}</span>`).join('')}</div></div><div class="island-world-summary"><div>${art('🌱')}<span><b id="islandWorldTotal">${world.total || 0}</b> ada hatırası</span></div><p>Her oyun küçük bir iz bırakır. Üç yere de istediğin sırayla gidebilirsin.</p></div>${rewards.length ? `<div class="island-keepsakes" aria-label="Ada hatıralarım">${rewards.slice(-8).map(reward => `<span>${art(reward.emoji)}<small>${escape(reward.label)}</small></span>`).join('')}</div>` : ''}`);
  }
  function start(zone) {
    reset();
    bind();
    const selected = getIslandMission(zone, getLetters(), getCompleted(), getContentState?.());
    if (!selected) {
      renderMap();
      feedback('Bir büyüğünle okulda öğrendiğin harfleri seçebilir, sonra birlikte oynayabilirsin.');
      return;
    }
    const mission = { ...selected, startedAt: performance.now(), exposureId: crypto.randomUUID() };
    const options = [...new Set(mission.options || [mission.target])];
    current = {
      mission, zone, phase: zone === 'care' ? 'companion' : zone === 'treasure' ? 'path' : 'build',
      companion: null, parcel: null, fed: false, played: false, hint: false,
      bank: shuffle(mission.tokens.map((text, id) => ({ text, id }))), selected: [], options: shuffle(options),
      pathTargets: [mission.tokens[0] || mission.target, mission.tokens[1] || mission.target, mission.target],
      pathIndex: 0, walkFrom: null, stone: null, completed: false, placement: null, justOpened: false,
    };
    current.stoneOptions = current.pathTargets.map(target => {
      const pool = target.length === 1 ? getLetters() : [...options, ...mission.tokens];
      return shuffle([target, ...shuffle([...new Set(pool)].filter(value => value !== target)).slice(0, 2)]);
    });
    renderMission();
    onContentExposure({ id: mission.exposureId, domain: 'activities', items: [mission.contentActivity], pool: mission.contentPools.activities });
    void announceInstruction();
  }
  function currentTarget() {
    return current.zone === 'treasure' && current.phase === 'path' ? current.pathTargets[current.pathIndex] : current.mission.target;
  }
  function instruction() {
    if (current.zone === 'care') return current.phase === 'companion' ? 'Bir dost seç.' : current.phase === 'play' ? 'Dostunla top oyna.' : current.parcel ? 'Şimdi paketi mama kabına koy.' : 'Paketi dinle ve bul.';
    if (current.zone === 'train') return current.selected.length === current.mission.tokens.length ? 'Vagonlar hazır. Treni gönder.' : 'Kartlara sırayla dokun, boşlukları doldur.';
    if (current.phase === 'path') return 'Doğru taşa basarak ilerle.';
    if (current.phase === 'placement') return 'Hazineni koyacağın yeri seç.';
    return current.selected.length === current.mission.tokens.length ? 'Sandığı aç.' : 'Kartlara sırayla dokun, boşlukları doldur.';
  }
  async function announceInstruction(withTarget = false) {
    if (!current || current.completed || muted()) return;
    const session = current;
    const epoch = generation;
    const target = currentTarget();
    const spoken = await speak(instruction());
    // A scene change cancels the whole voice chain, including a pending target.
    if (spoken === false || !withTarget || current !== session || generation !== epoch || muted()) return;
    await speak(target);
  }
  function listenTarget() {
    if (!current) return;
    if (muted()) {
      current.hint = true;
      updateHint();
      feedback('Ses kapalı. Karttaki örneğe bakarak da oynayabilirsin.');
      return;
    }
    void announceInstruction(true);
  }
  function updateHint() {
    const target = root.querySelector('#islandTarget');
    if (target) {
      target.textContent = currentTarget();
      target.hidden = !current.hint && !muted();
    }
    const hint = root.querySelector('[data-island="hint"]');
    if (hint) hint.textContent = current.hint ? 'İpucunu kapat' : 'Bir ipucu göster';
  }
  function soundControls() {
    const target = currentTarget();
    return `<div class="island-sound-tools">${button('listen', `${art(muted() ? '🔇' : '🔊')} ${muted() ? 'Örneğe bak' : 'Sesi dinle'}`, `data-audio-target="${escape(target)}"`, 'island-listen')}${button('hint', current.hint ? 'İpucunu kapat' : 'Bir ipucu göster', '', 'island-hint')}<span id="islandTarget" class="island-target"${current.hint || muted() ? '' : ' hidden'}>${escape(target)}</span></div>`;
  }
  function heading(instruction) {
    const explanation = current.zone === 'care' ? 'Küçük bir iyilik, sonra birlikte oyun.' : current.zone === 'train' ? 'Sesi dinle. Parçaları sıraya koy, kendi trenini gönder.' : 'Dinle, yolu keşfet, sandığı aç. Hazinenin yerini sen seç.';
    return `<div class="island-mission-heading"><span class="island-kicker">${current.zone === 'care' ? 'Hayvan dostlarım' : escape(current.mission.title)}</span><h1>${instruction}</h1><p>${explanation}</p></div>`;
  }
  function renderMission() {
    if (!current) return;
    const { zone, phase } = current;
    let body;
    if (zone === 'care') body = renderCare();
    else if (zone === 'train') body = renderTrain();
    else body = renderTreasure();
    root.innerHTML = shell(zone, phase, body);
    if (!current.completed && !['companion', 'play', 'placement'].includes(phase)) {
      const target = currentTarget();
      const domain = phase === 'path' && target !== current.mission.target
        ? target.length === 1 ? 'letters' : 'syllables' : current.mission.targetDomain;
      onContentExposure({ id: `${current.mission.exposureId}:${phase}:${current.pathIndex}`, domain,
        items: [target], pool: current.mission.contentPools[domain] || [] });
    }
    if (current.completed) feedback('Emek verdin! Adana yeni bir hatıra bıraktın.');
    else if (zone === 'care' && phase === 'play') feedback('Kasesi doldu, karnı doydu. Şimdi birlikte oynayalım!');
  }
  function renderCare() {
    const buddy = companions[current.companion] || companions.cat;
    const choosing = current.phase === 'companion';
    const happiness = current.played ? 100 : current.fed ? 60 : 0;
    const instruction = choosing ? 'Bugün kiminle oynayalım?' : current.phase === 'play' ? 'Şimdi oyun zamanı!' : current.completed ? 'Dostun çok mutlu!' : 'Dostunun paketini bulalım';
    return heading(instruction) + `<div class="island-care-scene${current.played ? ' is-playing' : ''}"><div class="island-sun" aria-hidden="true"></div><div class="island-care-tree" aria-hidden="true">${art('🌳')}</div><div class="island-pet-house" aria-hidden="true">${art('🏠')}</div><div class="island-pet${current.fed ? ' is-fed' : ''}" aria-label="${escape(buddy.name)}"><span class="island-pet-heart" aria-hidden="true">${current.fed ? '♥' : '?'}</span>${art(buddy.emoji)}<strong>${choosing ? 'Dostun seni bekliyor' : buddy.name}</strong></div><div class="island-ball" aria-hidden="true"><span></span></div>${button('feed', `<span class="island-bowl${current.fed ? ' is-filled' : ''}" aria-hidden="true"><span>${current.fed ? '<i></i><i></i><i></i><i></i><i></i><i></i>' : ''}</span></span><strong>${current.fed ? 'Kase doldu!' : current.parcel ? 'Paketi kaseye dök' : 'Dostunun kasesi'}</strong>`, `${!current.parcel || current.fed || choosing ? 'disabled' : ''}`, 'island-bowl-button')}<div class="island-happiness"><span>Birlikte iyi hissediyoruz</span><div id="islandHappiness" role="progressbar" aria-label="Dostunun keyfi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${happiness}"><span style="width:${happiness}%;--island-happiness-from:${current.played ? 60 : 0}%"></span></div><small>${happiness === 100 ? 'Doydu, oynadı, mutlu!' : happiness ? 'Yemek hazır, sırada oyun var' : 'İlginle mutlu olacak'}</small></div></div>${choosing ? `<div class="island-companions" aria-label="Dostunu seç">${Object.entries(companions).map(([id, companion]) => button('companion', `${art(companion.emoji)}<span>${companion.name}</span>`, `data-companion="${id}"`, 'island-companion')).join('')}</div>` : current.phase === 'play' || current.completed ? `<div class="island-action-dock">${button('play', `${art('🎮')} Topu yuvarla`, current.completed ? 'disabled' : '', 'island-primary')}<p>Küçük topu dostuna gönder. Birlikte eğlenin!</p></div>` : `${soundControls()}<div class="island-parcels" aria-label="Sesli paketler">${current.options.map(option => button('parcel', `<span class="island-parcel-ribbon" aria-hidden="true"></span><span>${escape(option)}</span><small>Sesli paket</small>`, `data-value="${escape(option)}" aria-pressed="${current.parcel === option}"`, `island-parcel${current.parcel === option ? ' is-picked' : ''}`)).join('')}</div><p class="island-scene-tip">Paketi seç, sonra dostunun kasesine dokun.</p>`}`;
  }
  function wagonTrain() {
    return `<div id="islandTrainRunning" class="island-train${current.completed ? ' is-departing' : ''}"><div class="island-engine" aria-hidden="true">${art('🚂')}<span class="island-steam"></span></div>${current.mission.tokens.map((_, index) => `<div class="island-wagon${current.selected[index] ? ' filled' : ''}"><span>${current.selected[index] ? escape(current.selected[index].text) : '·'}</span><i></i><i></i></div>`).join('')}</div>`;
  }
  function tokenBank(action) {
    return `<div class="island-token-bank" aria-label="${action === 'wagon' ? 'Vagon parçaları' : 'Şifre taşları'}">${current.bank.map(token => button(action, escape(token.text), `data-token-id="${token.id}"${current.selected.some(selected => selected.id === token.id) ? ' disabled' : ''}`, action === 'wagon' ? 'island-wagon-token' : 'island-rune-token')).join('')}</div>`;
  }
  function renderTrain() {
    const ready = current.selected.length === current.mission.tokens.length;
    return heading(current.completed ? 'Trenin yola çıktı!' : 'Vagonları kur, trenini yola çıkar') + `<div class="island-rail-scene"><div class="island-mountain island-mountain-one"></div><div class="island-mountain island-mountain-two"></div><div class="island-rail-cloud" aria-hidden="true"></div><div class="island-platform"><span>Alparslan İstasyonu</span></div><div id="islandNewStation" class="island-new-station${current.completed ? ' is-built' : ''}"${current.completed ? '' : ' hidden'} aria-label="Yeni istasyon">${art('🏫')}<strong>Yeni durak hazır!</strong></div><div class="island-rails" aria-hidden="true"></div>${wagonTrain()}<div class="island-rail-sign" aria-hidden="true">${current.completed ? 'Varış ✓' : 'Harf treni'}</div></div>${current.completed ? '<p class="island-arrival-note">Vagonların birlikte yola çıktı. Adandaki istasyon büyüyor!</p>' : `${soundControls()}<div class="island-workshop"><p>Parçalara sırayla dokun. Her parça ayrı bir vagona dönüşür.</p>${tokenBank('wagon')}<div class="island-workshop-controls">${button('undo', 'Son vagonu geri al', current.selected.length ? '' : 'disabled', 'island-hint')}${button('send', `${art('🚂')} Treni gönder`, ready ? '' : 'disabled', 'island-primary')}</div></div>`}`;
  }
  function renderTreasure() {
    const { phase, pathIndex } = current;
    const codeReady = current.selected.length === current.mission.tokens.length;
    const opened = phase === 'placement' || current.completed;
    const instruction = phase === 'path' ? 'Sesli taşlardan hazineye gidelim' : phase === 'code' ? 'Sandığın şifresini birlikte kuralım' : current.completed ? 'Hazinen adanda yerini buldu!' : 'Hazinen nereye yerleşsin?';
    const progress = Math.min(pathIndex, 3);
    const walkFrom = current.walkFrom;
    const opening = current.justOpened;
    current.walkFrom = null;
    current.justOpened = false;
    return heading(instruction) + `<div class="island-treasure-scene${opened ? ' chest-open' : ''}"><div class="island-explorer-path" aria-hidden="true"><span></span><span></span><span></span></div><div class="island-explorer${walkFrom === null ? '' : ' is-walking'}" style="--island-explorer-step:${progress};--island-explorer-from:${walkFrom ?? progress}" aria-label="Alparslan ${progress} taş ilerledi">${art('🦁')}</div><div class="island-stepping-stones" aria-label="Keşif yolu">${[0, 1, 2].map(index => `<span class="island-path-stone${index < progress ? ' is-crossed' : ''}${index === progress ? ' is-current' : ''}" aria-label="${index + 1}. taş${index < progress ? ' geçildi' : ''}">${index < progress ? '✓' : index + 1}</span>`).join('')}</div><div class="island-chest-place">${chest(opened, opening)}${opened ? `<div class="island-chest-prize" aria-label="${escape(current.mission.reward.label)}">${art(current.mission.reward.emoji)}</div>` : '<span class="island-chest-question">?</span>'}</div><div class="island-treasure-bush" aria-hidden="true">${art('🌳')}${art('🌷')}</div>${current.completed ? `<div class="island-placed-prize">${art(current.mission.reward.emoji)}<strong>${escape(placements[current.placement].label)} yerleşti!</strong></div>` : ''}</div>${phase === 'path' ? `${soundControls()}<div class="island-stone-choices" aria-label="Sesli yol taşları">${current.stoneOptions[pathIndex].map(option => button('stone', `<span>${escape(option)}</span>`, `data-value="${escape(option)}" aria-pressed="${current.stone === option}"`, `island-choice-stone${current.stone === option ? ' is-picked' : ''}`)).join('')}</div><div class="island-action-dock">${button('walk', 'Bu taşa bas →', current.stone ? '' : 'disabled', 'island-primary')}<p>Önce sesi dinle, taşı seç, sonra üzerine bas.</p></div>` : phase === 'code' ? `${soundControls()}<div class="island-code-lock" aria-label="Sandık şifresi">${current.mission.tokens.map((_, index) => `<span class="${current.selected[index] ? ' is-filled' : ''}">${current.selected[index] ? escape(current.selected[index].text) : '·'}</span>`).join('')}</div>${tokenBank('code')}<div class="island-workshop-controls">${button('undo', 'Son taşı geri al', current.selected.length ? '' : 'disabled', 'island-hint')}${button('open', 'Sandığı aç', codeReady ? '' : 'disabled', 'island-primary')}</div>` : current.completed ? `<p class="island-arrival-note">${escape(current.mission.reward.label)} artık adanın bir parçası.</p>` : `<div class="island-placement-choices" aria-label="Hazinene bir yer seç">${Object.entries(placements).map(([id, placement]) => button('place', `${art(placement.emoji)}<strong>${placement.label}</strong>`, `data-placement="${id}"`, 'island-placement')).join('')}</div><p class="island-scene-tip">Bir yer seç. Adana döndüğünde hazinen seni orada bekleyecek.</p>`}`;
  }
  function finish(placement = null) {
    if (!current || current.completed) return;
    current.completed = true;
    current.placement = placement;
    current.phase = 'complete';
    const completed = current;
    renderMission();
    stopSpeech();
    onComplete({ ...completed.mission, ...(placement ? { placement } : {}), ...(completed.zone === 'care' ? { companion: completed.companion } : {}) });
    later(() => {
      if (current !== completed) return;
      celebrate({
        message: completed.zone === 'care' ? `${companions[completed.companion].name} doydu, oynadı ve çok mutlu! Dostun adanda seni bekleyecek.` : completed.mission.success,
        itemText: completed.mission.target,
        onContinue: () => { if (current === completed) renderMap(); },
      });
    }, completed.zone === 'train' ? 1550 : 850);
  }
  function selectToken(id) {
    const token = current.bank.find(entry => entry.id === id);
    if (!token || current.selected.some(entry => entry.id === id)) return;
    const expected = current.mission.tokens[current.selected.length];
    if (token.text !== expected) {
      feedback('Birlikte yeniden dinleyelim. Parçaları baştan sona sırayla yerleştiriyoruz.');
      return;
    }
    current.selected.push(token);
    if (!muted()) void speak(token.text);
    renderMission();
    if (current.selected.length === current.mission.tokens.length) void announceInstruction();
    feedback(current.selected.length === current.mission.tokens.length ? current.zone === 'train' ? 'Vagonlar hazır! Şimdi trenini kendin yola çıkar.' : 'Şifre hazır! Şimdi sandığı açabilirsin.' : 'Bir parça yerleşti. Sıradaki parçayı da bulalım.');
  }
  function handleClick(event) {
    const control = event.target.closest('[data-island]');
    if (!control || !root.contains(control) || control.disabled) return;
    const action = control.dataset.island;
    if (action === 'exit') { destroy(); onExit(); return; }
    if (action === 'map' || action === 'pause') { renderMap(); if (action === 'pause') feedback('Küçük bir mola. Hazır olduğunda istediğin yere gidebilirsin.'); return; }
    if (action === 'start') { start(control.dataset.zone); return; }
    if (!current || current.completed) return;
    if (action === 'listen') { listenTarget(); return; }
    if (action === 'guide') { void announceInstruction(); return; }
    if (action === 'hint') { current.hint = !current.hint; updateHint(); return; }
    if (action === 'companion' && current.zone === 'care' && current.phase === 'companion') {
      if (!companions[control.dataset.companion]) return;
      current.companion = control.dataset.companion;
      current.phase = 'parcel';
      renderMission();
      void announceInstruction();
      feedback('Dostunu seçtin. Sesli paketini birlikte bulalım.');
    } else if (action === 'parcel' && current.zone === 'care' && current.phase === 'parcel') {
      if (control.dataset.value !== current.mission.target) { feedback('Bu paket burada beklesin. Sesi yeniden dinleyebilir veya ipucuna bakabilirsin.'); return; }
      current.parcel = control.dataset.value;
      renderMission();
      void announceInstruction();
      feedback('Paketi buldun! Şimdi dostunun kasesine dokun.');
    } else if (action === 'feed' && current.zone === 'care' && current.parcel && !current.fed) {
      current.fed = true;
      current.phase = 'play';
      renderMission();
      void announceInstruction();
    } else if (action === 'play' && current.zone === 'care' && current.fed) {
      current.played = true;
      finish();
    } else if ((action === 'wagon' && current.zone === 'train' || action === 'code' && current.zone === 'treasure' && current.phase === 'code')) {
      selectToken(Number(control.dataset.tokenId));
    } else if (action === 'undo' && current.selected.length) {
      current.selected.pop();
      renderMission();
      feedback('Son parça geri geldi. Yeniden deneyebilirsin.');
    } else if (action === 'send' && current.zone === 'train' && current.selected.length === current.mission.tokens.length) {
      finish();
    } else if (action === 'stone' && current.zone === 'treasure' && current.phase === 'path') {
      if (control.dataset.value !== currentTarget()) { feedback('Bu taşta biraz bekleyelim. Sesi yeniden dinle, sonra başka bir taş deneyebilirsin.'); return; }
      current.stone = control.dataset.value;
      renderMission();
      void announceInstruction();
      feedback('Doğru taşı buldun. Hazırsan üzerine bas!');
    } else if (action === 'walk' && current.zone === 'treasure' && current.phase === 'path' && current.stone) {
      current.walkFrom = current.pathIndex;
      current.pathIndex++;
      current.stone = null;
      if (current.pathIndex === 3) current.phase = 'code';
      renderMission();
      void announceInstruction();
      feedback(current.phase === 'code' ? 'Hazineye ulaştın! Şimdi sandığın sesli şifresini kuralım.' : 'Yeni bir taşa geldin. Sıradaki sesi dinleyelim.');
    } else if (action === 'open' && current.zone === 'treasure' && current.phase === 'code' && current.selected.length === current.mission.tokens.length) {
      current.phase = 'placement';
      current.justOpened = true;
      renderMission();
      void announceInstruction();
      feedback('Sandık açıldı! Hazinen adanın neresine yerleşsin?');
    } else if (action === 'place' && current.zone === 'treasure' && current.phase === 'placement' && placements[control.dataset.placement]) {
      finish(control.dataset.placement);
    }
  }
  function destroy() {
    reset();
    if (listening) root.removeEventListener('click', handleClick);
    listening = false;
  }
  return { renderMap, start, destroy };
}
