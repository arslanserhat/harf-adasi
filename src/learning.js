import './learning.css';
import { mountWritingGuard, releaseWritingGuard } from './writing.js';
import {
  ALPHABET, SKILLS, normalizeLearningState, parseWordList, splitSyllables,
  getEligibleWords, planSession, recordAttempt, summarizeLearning,
} from './learning-model.js';
import { renderStoryScene, mountStoryScene, STORY_TITLE } from './story-scene.js';

const SKILL_NAMES = {
  listen: 'Dinleyip tanıma', syllables: 'Heceleri birleştirme', build: 'Harflerle kurma',
  recall: 'Örneksiz hatırlama', write: 'Birlikte kontrol edilen yazma',
  meaning: 'Anlamını bulma', sentence: 'Cümlede kullanma',
};
const TITLES = {
  listen: 'Siparişi dinle, kartını bul', syllables: 'Etiketin parçalarını birleştir',
  build: 'Harflerle etiketini hazırla', recall: 'Hatırlama postan geldi',
  write: 'Etiketi kendi elinle yaz', meaning: 'Kelimenin anlamını keşfet',
  sentence: 'Mesajın kelimelerini sırala',
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const uid = () => globalThis.crypto?.randomUUID?.() || `list-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const shuffle = source => {
  const values = [...source];
  for (let index = values.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
};
const control = (action, label, attributes = '', className = '') =>
  `<button type="button" class="learn-button ${className}" data-learning="${action}" ${attributes}>${label}</button>`;

/** The host owns persistence. This controller never reads another child's data. */
export function createLearning({
  root, getState, setState, getLetters, speak, stopSpeech = () => {},
  isMuted = () => false, onHome = () => {}, onPracticeLetter = () => {},
  onOpenSettings = () => {}, getSyncStatus = () => '', playEffect = () => {},
}) {
  if (!root || !getState || !setState || !getLetters) throw new Error('Learning host is incomplete');
  let listening = false;
  let screen = '';
  let lastScreen = 'home';
  let taskUi = null;
  let writingCleanup = null;
  let storyCleanup = null;
  let editListId = '';
  let speechEpoch = 0;
  let parentDraft = null;

  function snapshot() { return normalizeLearningState(getState()); }
  function persist(next) {
    const state = { ...next, updatedAt: Date.now() };
    setState(state);
    return state;
  }
  function stop() {
    speechEpoch += 1;
    stopSpeech();
    writingCleanup?.();
    writingCleanup = null;
    storyCleanup?.();
    storyCleanup = null;
    releaseWritingGuard();
  }
  function attach() {
    if (listening) return;
    root.addEventListener('click', click);
    root.addEventListener('change', change);
    listening = true;
  }
  function enter(nextScreen) {
    stop();
    attach();
    screen = nextScreen;
    lastScreen = nextScreen;
    taskUi = null;
  }
  function activeList(state) {
    return state.lists.find(list => list.id === state.activeListId) || state.lists[0];
  }
  function wordEntry(state, text) {
    return state.lists.flatMap(list => list.words).find(word => word.text === text)
      || { text, parts: splitSyllables(text), meaning: '', sentence: '' };
  }
  function sessionIsUsable(state) {
    return state.session?.tasks?.length && state.session.index < state.session.tasks.length;
  }
  function sessionFitsLetters(session, allowedWords) {
    const selected = new Set(getLetters());
    const fits = value => [...String(value ?? '').normalize('NFC').toLocaleLowerCase('tr-TR')]
      .filter(letter => ALPHABET.includes(letter)).every(letter => selected.has(letter));
    return session.tasks.slice(session.index).every(task => (allowedWords.has(task.word) || task.word.length === 1 && selected.has(task.word))
      && fits(task.target) && (task.tokens || []).every(fits)
      && (task.options || []).every(option => fits(typeof option === 'string' ? option : option.text || option.value)));
  }
  function nav(extra = '') {
    return `<div class="learn-nav">${control('home', '← Adaya dön', '', 'quiet')}<span>Kendi hızında, birlikte</span>${extra || control('parent', 'Listeler ve gelişim', '', 'quiet')}</div>`;
  }
  function feedback(message, tone = '') {
    const element = root.querySelector('#learningFeedback');
    if (element) { element.textContent = message; element.dataset.tone = tone; }
  }
  function reportParent(message, error = false) {
    const element = root.querySelector('#learningErrors');
    if (element) { element.textContent = message; element.dataset.error = String(error); element.hidden = false; }
  }
  function dateLabel(timestamp) {
    if (!Number.isFinite(Number(timestamp)) || !Number(timestamp)) return 'Henüz planlanmadı';
    const now = Date.now();
    if (timestamp <= now) return 'Yeniden karşılaşmaya hazır';
    if (timestamp - now < 86400000 && new Date(timestamp).toDateString() === new Date(now).toDateString()) return 'Bugün yeniden gelecek';
    const days = Math.ceil((timestamp - now) / 86400000);
    return days === 1 ? 'Bir sonraki gün kontrol edilecek' : `${days} gün içinde yeniden gelecek`;
  }
  function progressFor(state, word) {
    return state.progress?.[word] || {};
  }
  function dueCount(state, eligible) {
    return eligible.filter(word => Object.values(progressFor(state, word.text))
      .some(progress => progress?.nextDueAt && progress.nextDueAt <= Date.now())).length;
  }
  function sceneMarkup(phase, session = snapshot().session) {
    const task = session?.tasks?.[session.index];
    return `<div id="learningStory">${renderStoryScene({
      phase, index: session?.index || 0, total: session?.tasks?.length || 8,
      completed: Object.values(session?.results || {}).filter(result => result.correct).length,
      skill: session?.tasks?.[session.index]?.kind || '',
      hiddenWord: phase === 'task' && ['listen', 'recall'].includes(task?.kind) ? task.word : '',
    })}</div>`;
  }
  function mountScene() {
    storyCleanup?.();
    const container = root.querySelector('#learningStory');
    storyCleanup = container ? mountStoryScene(container, {
      onListen: text => isMuted() ? Promise.resolve(false) : speak(text),
      onHelp: () => {
        if (!taskUi || taskUi.result.correct) return;
        countHint(); taskUi.model = true; showModel();
        feedback('Birlikte bakalım. Örneği açtım; hazır olduğunda yeniden deneyebilirsin.', 'help');
      },
    }) : null;
  }
  function renderIntro() {
    enter('intro');
    const session = snapshot().session;
    root.innerHTML = `<section id="learning" class="learning" data-screen="intro">${nav()}
      <div class="learn-intro"><span class="learn-eyebrow">Birlikte okuyacağımız bir macera</span><h1>${escape(STORY_TITLE)}</h1><p>Adadaki mektubun etiketleri eksik. Kelimeleri kurup kullanarak mektubu bahçeye ulaştıracağız.</p></div>
      ${sceneMarkup('intro', session)}
      <div class="learn-intro-plan"><b>${session.tasks.length} küçük görev, tek bir macera</b><p>Dinleyeceğiz, parçaları birleştireceğiz, yazıp kontrol edeceğiz. Daha önce çalıştığın kelimeler de hatırlama postasıyla geri gelecek.</p></div>
      <div class="learn-actions">${control('begin-tasks', 'Mektubu birlikte hazırlayalım →', '', 'primary')}${control('parent', 'Öğretmenimin kelimeleri', '', 'quiet')}</div>
    </section>`;
    mountScene(); window.scrollTo(0, 0);
  }
  function renderHome() {
    enter('home');
    const state = snapshot();
    const list = activeList(state);
    const { eligible, blocked } = getEligibleWords(state, getLetters());
    const continuing = sessionIsUsable(state);
    root.innerHTML = `<section id="learning" class="learning" data-screen="home">
      ${nav()}
      <div class="learn-intro"><span class="learn-eyebrow">Sana göre hazırlanan çalışmalar</span><h1>Bugünün yolculuğu</h1><p>Bir kelimeyi kuracağız, başka bir yerde kullanacağız, sonra yeniden hatırlayacağız.</p></div>
      <div class="learn-journey-card"><div class="learn-mascot" aria-hidden="true">🌱</div><div><h2>${escape(list?.title || 'Kelime listem')}</h2><p>${eligible.length} kelimeyle, okulda öğrendiğin harflerle.</p><p class="learn-small">${continuing ? `${state.session.index + 1}. görevden devam edebilirsin. Yazı ve okuma adımların kaldığın yerde.` : 'Kısa görevler, küçük yardımlar ve kendi hızında ilerleme.'}</p></div></div>
      <div class="learn-milestones" aria-label="Birbirine bağlı öğrenme adımları"><span>Dinle</span><span>Birleştir</span><span>Yaz</span><span>Hatırla</span></div>
      <div class="learn-actions">${control('start', continuing ? 'Yolculuğuma devam et →' : 'Yolculuğuma başla →', eligible.length ? '' : 'disabled', 'primary')}${control('parent', 'Öğretmenimin kelimeleri', '', 'quiet')}</div>
      ${!eligible.length ? '<p class="learn-notice">Bu listedeki kelimeler için harf seçimi gerekiyor. Bir büyüğünle listeler alanını açabilirsin.</p>' : ''}
      ${blocked.length ? `<p class="learn-small">Listendeki ${blocked.length} kelime, harflerini okulda öğrendiğinde yolculuğa katılacak.</p>` : ''}
      <div class="learn-preview-grid"><div><b>Hatırlama postası</b><p>${dueCount(state, eligible) ? 'Önceden çalıştığın bazı kelimeler bugün yeni bir görevle geri gelecek.' : 'Çalıştığın kelimeler sonraki günlerde yeni görevlerle geri gelecek.'}</p></div><div><b>Yardım her zaman yanında</b><p>Zorlandığında ipucu isteyebilirsin. Hazır olduğunda sıradaki adıma sen geçersin.</p></div></div>
    </section>`;
  }
  function start() {
    const state = snapshot();
    const { eligible } = getEligibleWords(state, getLetters());
    if (!eligible.length) { renderHome(); return; }
    let next = state;
    const allowed = new Set(eligible.map(word => word.text));
    if (!sessionIsUsable(state) || !sessionFitsLetters(state.session, allowed)) {
      next = persist({ ...state, session: planSession(state, getLetters(), Date.now(), { limit: 8 }) });
    } else if (state.session.paused) {
      next = persist({ ...state, session: { ...state.session, paused: false } });
    }
    if (!next.session?.tasks?.length) { renderHome(); return; }
    if (!next.session.storySeen) renderIntro();
    else renderTask();
  }
  function currentTask(state = snapshot()) { return state.session?.tasks?.[state.session.index]; }
  function draftFor(state, task) {
    return state.session?.results?.[task.id] || { correct: false, mistakes: 0, hints: 0, writingReviewed: false, independent: true };
  }
  function saveDraft(changes) {
    const state = snapshot();
    const task = currentTask(state);
    if (!task) return;
    const result = { ...draftFor(state, task), ...changes };
    persist({ ...state, session: { ...state.session, results: { ...state.session.results, [task.id]: result } } });
    if (taskUi) taskUi.result = result;
  }
  function countHint() {
    if (!taskUi || taskUi.result.correct) return;
    saveDraft({ hints: taskUi.result.hints + 1, independent: false });
  }
  function finishTask({ writingReviewed = false } = {}) {
    if (!taskUi || taskUi.result.correct) return;
    const state = snapshot();
    const task = currentTask(state);
    const draft = draftFor(state, task);
    const independent = draft.independent !== false && !draft.hints && !draft.mistakes;
    const attempt = {
      id: task.id, word: task.word, skill: task.skill, correct: true,
      mistakes: draft.mistakes, hints: draft.hints, writingReviewed,
      independent, at: Date.now(),
    };
    let next = recordAttempt(state, attempt, attempt.at);
    next = { ...next, session: { ...next.session, results: { ...next.session.results, [task.id]: { ...draft, ...attempt } } } };
    persist(next);
    taskUi.result = { ...draft, ...attempt };
    playEffect('correct');
    root.querySelectorAll('[data-learning="tile"], [data-learning="choice"]').forEach(button => { button.disabled = true; });
    const nextButton = root.querySelector('#learningNext');
    if (nextButton) nextButton.disabled = false;
    const messages = {
      listen: 'Siparişin kartını buldun. Şimdi kelimeyle başka bir iş yapacağız.',
      syllables: 'Parçaları birleştirdin. Kelime artık bir bütün.',
      build: 'Harflerle kelimeyi kurdun. Bu kelime yolculukta yeniden karşına çıkacak.',
      recall: independent ? 'Örneği açmadan kelimeyi kurdun. Hatırlama denemen kaydedildi.' : 'Yardımla kelimeyi kurdun. Başka bir zaman yeniden deneyeceğiz.',
      write: 'Yazınızı birlikte kontrol ettiniz. Sonraki görev hazır.',
      meaning: 'Kelimenin anlamıyla yaptığımız işi eşleştirdin.',
      sentence: 'Mesajı tamamladın. Kelimeyi cümlenin içinde kullandın.',
    };
    feedback(messages[task.kind] || 'Bu adım tamam. Hazır olduğunda devam et.', 'success');
    const scene = root.querySelector('#learningStory');
    if (scene) { storyCleanup?.(); scene.outerHTML = sceneMarkup('success', next.session); mountScene(); }
    const prompt = root.querySelector('#learningModel');
    if (prompt && ['build', 'recall', 'syllables'].includes(task.kind)) {
      prompt.hidden = false;
      prompt.textContent = task.word;
    }
  }
  function wrong() {
    if (!taskUi || taskUi.result.correct) return;
    saveDraft({ mistakes: taskUi.result.mistakes + 1, independent: false });
    playEffect('retry');
    const task = taskUi.task;
    if (taskUi.result.mistakes >= 2 && !taskUi.model) {
      taskUi.model = true;
      countHint();
      showModel();
      feedback('Birlikte bakalım. Örneği açtım; sıradaki parçayı bulabilirsin.', 'help');
    } else {
      feedback(['build', 'recall', 'syllables', 'sentence'].includes(task.kind)
        ? 'Sıradaki parçaya yeniden bakalım. İstersen bir ipucu açabiliriz.'
        : 'Birlikte yeniden deneyelim. İstersen sesi tekrar dinleyebilirsin.', 'help');
    }
  }
  function observeLetter(position, letter, correct) {
    if (!taskUi || taskUi.task.kind !== 'build' || taskUi.task.word.length < 2 || !ALPHABET.includes(letter)) return;
    const state = snapshot();
    const draft = draftFor(state, taskUi.task);
    persist(recordAttempt(state, {
      id: `${taskUi.task.id}:letter:${position}:${correct ? 'placed' : 'retry'}`,
      word: letter, skill: 'build', correct, hints: draft.hints,
      mistakes: correct ? draft.mistakes : Math.max(1, draft.mistakes), writingReviewed: false,
      independent: correct && draft.independent !== false && !draft.hints && !draft.mistakes,
      at: Date.now(),
    }));
  }
  function showModel() {
    let model = root.querySelector('#learningModel');
    if (!model && taskUi && ['listen', 'meaning'].includes(taskUi.task.kind)) {
      model = document.createElement('div');
      model.id = 'learningModel'; model.className = 'learn-whole-word';
      root.querySelector('.learn-task-controls')?.after(model);
    }
    if (model && taskUi) {
      model.hidden = !taskUi.model;
      model.textContent = taskUi.task.kind === 'sentence' ? taskUi.task.target
        : taskUi.task.kind === 'meaning' ? taskUi.task.meaning || 'Kelimeyi ve resimleri bir büyüğünle birlikte incele.'
          : taskUi.task.word;
    }
    const button = root.querySelector('[data-learning="show-model"]');
    if (button) button.textContent = taskUi?.model ? 'Örneği kapat' : 'Örneği göster';
  }
  function instructions(task) {
    if (task.word.length === 1 && task.kind === 'write') return 'Daha önce çalıştığın harfi dinle ve yaz. Bir büyüğünle birlikte kontrol et.';
    if (task.word.length === 1 && task.kind === 'build') return 'Harfi dinle ve kartını bul. İstersen örneği açıp birlikte bakabiliriz.';
    if (task.kind === 'listen') return 'Önce siparişi dinle. Duyduğun kelimenin kartına dokun.';
    if (task.kind === 'write') return 'Kelimeyi dinle ve yaz. Bitirince bir büyüğünle kontrol et.';
    if (task.kind === 'recall') return 'Kelimeyi dinle, harflerini aklından sırala. İhtiyacın olursa örneği aç.';
    if (task.kind === 'meaning') return 'Kelimeyi oku. Ona uygun anlamı ya da resmi bul.';
    if (task.kind === 'sentence') return 'Mesajı dinle. Kelime kartlarını sırayla yerleştir.';
    return task.kind === 'syllables' ? 'Hece kartlarına sırayla dokun. Birleşince kelimenin tamamını oku.' : 'Harf kartlarına sırayla dokun. Aynı harften iki tane varsa ikisini de kullan.';
  }
  function taskBody(task, state) {
    const entry = wordEntry(state, task.word);
    const audioLabel = task.kind === 'sentence' ? 'Mesajı dinle' : task.kind === 'listen' ? 'Siparişi dinle' : 'Kelimeyi dinle';
    let html = `<div class="learn-task-controls">${control('listen', `<i data-lucide="volume-2"></i>${audioLabel}`, '', task.kind === 'listen' ? 'listen-primary' : 'quiet')}`;
    if (task.kind !== 'meaning' && task.kind !== 'listen') html += control('show-model', taskUi.model ? 'Örneği kapat' : 'Örneği göster', '', 'quiet');
    html += '</div>';
    if (task.kind === 'listen') html += `<div class="learn-adult-audio">${control('adult-read', 'Bir büyüğümle kelimeyi okuyalım', '', 'quiet')}</div>`;
    if (task.kind === 'meaning') {
      html += `<div class="learn-whole-word">${escape(task.word)}</div>`;
    } else if (task.kind !== 'listen') {
      html += `<div class="learn-whole-word" id="learningModel" ${taskUi.model ? '' : 'hidden'}>${escape(task.kind === 'sentence' ? task.target : task.word)}</div>`;
    }
    if (task.kind === 'write') {
      html += `<div class="learn-notebook pad"><span class="pad-label">SENİN YAZI ALANIN</span><svg id="learningPad" viewBox="0 0 640 300" role="img" aria-label="${escape(task.word)} serbest yazma alanı"><path class="guide" d="M20 75H620M20 145H620M20 280H620"/><path class="baseline" d="M20 220H620"/><g id="learningInk"></g></svg></div>
        <div class="learn-writing-controls">${control('clear', 'Yeniden yaz', '', 'quiet')}${control('review', 'Yazdım, birlikte bakalım', '', 'primary')}</div>
        <p class="learn-writing-note">El yazısı otomatik tanınmaz. Yazını bir büyüğünle birlikte kontrol et.</p>
        <div id="learningReview" class="learn-review" hidden><strong>Birlikte kontrol edelim</strong><p>Yazılan kelime ${escape(task.word)} mi? Harflerini ve sırasını birlikte inceleyin.</p>${control('approve', 'Birlikte kontrol ettik', '', 'primary')}${control('retry-writing', 'Yeniden deneyeceğiz', '', 'quiet')}</div>`;
    } else if (task.kind === 'listen' || task.kind === 'meaning') {
      const choices = task.options?.length ? task.options : task.kind === 'meaning' ? [entry.meaning] : [task.target || task.word];
      html += `<div class="learn-choices">${shuffle(choices).map(choice => {
        const text = typeof choice === 'string' ? choice : choice.text || choice.label || choice.value;
        const value = typeof choice === 'string' ? choice : choice.value || choice.text || choice.label;
        return control('choice', escape(text), `data-value="${escape(value)}"`, task.kind === 'meaning' ? 'meaning-choice' : 'word-choice');
      }).join('')}</div>`;
    } else {
      html += '<div class="learn-slots" id="learningSlots" aria-label="Yerleştirilen parçalar"></div><div class="learn-bank" id="learningBank" aria-label="Kullanılabilir parçalar"></div>';
      html += `<div class="learn-task-controls">${control('undo', 'Son parçayı geri al', '', 'quiet')}${control('restart', 'Yeniden sırala', '', 'quiet')}</div>`;
    }
    return html;
  }
  function renderTask() {
    enter('task');
    let state = snapshot();
    const task = currentTask(state);
    if (!task) { renderSummary(); return; }
    const result = draftFor(state, task);
    const initialModel = task.support >= 2 && ['syllables', 'build', 'sentence', 'write'].includes(task.kind);
    const tokens = task.tokens?.length ? task.tokens : task.kind === 'sentence' ? task.target.split(/\s+/) : task.kind === 'syllables' ? task.parts : [...task.word];
    const letterChoice = task.kind === 'build' && task.word.length === 1;
    const bankTokens = letterChoice && task.options?.length ? task.options : tokens;
    taskUi = {
      task, result, model: initialModel, selected: [], expectedTokens: [...tokens], letterChoice,
      bank: shuffle((bankTokens || []).map((text, id) => ({ id, text }))),
      inkLength: 0, audioPlayed: false,
    };
    const trivialChoice = task.kind === 'listen' && task.options.length < 2;
    if ((initialModel || trivialChoice) && !result.correct && !result.modelOpened) {
      saveDraft({ hints: result.hints + 1, independent: false, modelOpened: true });
      state = snapshot();
    }
    root.innerHTML = `<section id="learning" class="learning learning-task${task.kind === 'write' ? ' learning-writing lesson' : ''}" data-screen="task" data-kind="${escape(task.kind)}" data-word="${escape(task.word)}" data-task-id="${escape(task.id)}">
      ${nav(control('pause', 'Mola ver', '', 'quiet'))}
      <div class="learn-task-header"><span class="learn-eyebrow">${task.kind === 'recall' ? 'Hatırlama postası' : 'Birbirine bağlı küçük görevler'}</span><h1>${escape(TITLES[task.kind] || 'Birlikte keşfedelim')}</h1><p>${escape(instructions(task))}</p></div>
      <div class="learn-session-track" aria-label="${state.session.index + 1}. görev, toplam ${state.session.tasks.length}">${state.session.tasks.map((_, index) => `<span class="${index < state.session.index ? 'past' : index === state.session.index ? 'current' : ''}"></span>`).join('')}<small>${state.session.index + 1} / ${state.session.tasks.length}</small></div>
      ${task.kind === 'write' ? '' : sceneMarkup(result.correct ? 'success' : 'task', state.session)}
      <div class="learn-workspace exercise">${taskBody(task, state)}<div id="learningFeedback" class="learn-feedback" role="status" aria-live="polite">${result.correct ? 'Bu adım kaydedildi. Hazır olduğunda devam et.' : 'Hazır olduğunda başlayabilirsin.'}</div></div>
      <div class="learn-next-row"><span>Hazır olduğunda sen devam et.</span>${control('next', state.session.index + 1 === state.session.tasks.length ? 'Yolculuğu tamamla →' : 'Sıradaki görev →', `id="learningNext" ${result.correct ? '' : 'disabled'}`, 'primary')}</div>
      ${task.kind === 'build' || task.kind === 'write' ? `<div class="learn-letter-help">${control('letter-help', 'Bir harfi birlikte çalışalım', '', 'quiet')}</div>` : ''}
    </section>`;
    if (!['listen', 'meaning', 'write'].includes(task.kind)) {
      if (result.correct) {
        for (const token of tokens) {
          const tile = taskUi.bank.find(item => item.text === token && !taskUi.selected.some(used => used.id === item.id));
          if (tile) taskUi.selected.push(tile);
        }
      }
      renderTokens();
    }
    if (task.kind === 'write') mountNotebook();
    else mountScene();
    if (state.session.paused) renderPause();
    window.scrollTo(0, 0);
  }
  function renderTokens() {
    if (!taskUi) return;
    const { bank, selected, result } = taskUi;
    const slots = root.querySelector('#learningSlots');
    const bankElement = root.querySelector('#learningBank');
    if (!slots || !bankElement) return;
    slots.innerHTML = taskUi.expectedTokens.map((_, index) => `<span class="learn-slot ${selected[index] ? 'filled' : ''}" aria-label="${index + 1}. boşluk${selected[index] ? `: ${escape(selected[index].text)}` : ''}">${escape(selected[index]?.text || '')}</span>`).join('');
    bankElement.innerHTML = bank.map(tile => control('tile', escape(tile.text), `data-id="${tile.id}" data-value="${escape(tile.text)}" ${result.correct || selected.some(item => item.id === tile.id) ? 'disabled' : ''}`, 'learn-tile')).join('');
  }
  function mountNotebook() {
    const svg = root.querySelector('#learningPad');
    if (!svg) return;
    const ink = root.querySelector('#learningInk');
    const namespace = 'http://www.w3.org/2000/svg';
    let pointerId = null;
    let last = null;
    let path = null;
    let coordinates = [];
    const point = event => {
      const value = svg.createSVGPoint(); value.x = event.clientX; value.y = event.clientY;
      const matrix = svg.getScreenCTM();
      const transformed = matrix ? value.matrixTransform(matrix.inverse()) : value;
      return { x: Math.max(0, Math.min(640, transformed.x)), y: Math.max(0, Math.min(300, transformed.y)) };
    };
    const add = value => {
      if (last) taskUi.inkLength += Math.hypot(value.x - last.x, value.y - last.y);
      coordinates.push(value);
      path.setAttribute('d', coordinates.map((item, index) => `${index ? 'L' : 'M'}${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(' '));
      last = value;
    };
    const down = event => {
      if (!taskUi || taskUi.result.correct || pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      pointerId = event.pointerId; last = null; coordinates = [];
      path = document.createElementNS(namespace, 'path'); path.setAttribute('class', 'learn-ink'); ink.appendChild(path);
      try { svg.setPointerCapture(pointerId); } catch { /* Touch fallback is guarded too. */ }
      add(point(event));
    };
    const move = event => {
      if (pointerId !== event.pointerId || !taskUi) return;
      event.preventDefault(); add(point(event));
    };
    const up = event => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      try { if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId); } catch { /* Released by Safari. */ }
      saveDraft({ inkPaths: [...ink.querySelectorAll('path')].slice(-12).map(element => element.getAttribute('d')).filter(value => value && value.length <= 8000) });
    };
    for (const data of taskUi.result.inkPaths || []) {
      if (typeof data !== 'string' || data.length > 8000 || !/^M[-\d .L]+$/.test(data)) continue;
      const element = document.createElementNS(namespace, 'path');
      element.setAttribute('class', 'learn-ink'); element.setAttribute('d', data); ink.appendChild(element);
      try { taskUi.inkLength += element.getTotalLength(); } catch { element.remove(); }
    }
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);
    mountWritingGuard(svg);
    writingCleanup = () => {
      svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up);
      svg.removeEventListener('lostpointercapture', up);
    };
  }
  async function playTask() {
    if (!taskUi) return;
    const current = taskUi;
    if (isMuted()) { feedback('Ses kapalı. Üstteki hoparlörden açabilir veya “Bir büyüğümle kelimeyi okuyalım” düğmesini kullanabilirsin.', 'help'); return; }
    // Hearing the target is part of a listening/dictation task. On reading and
    // meaning tasks it is assistance and must never yield independent credit.
    if (['meaning', 'sentence'].includes(current.task.kind)) countHint();
    const epoch = ++speechEpoch;
    const target = current.task.kind === 'sentence' ? current.task.target : current.task.word;
    root.querySelector('[data-learning="listen"]')?.setAttribute('aria-busy', 'true');
    if (current.task.kind === 'listen') {
      current.audioPlayed = false;
      root.querySelectorAll('[data-learning="choice"]').forEach(button => { button.disabled = true; });
      feedback('Siparişi dinleyelim. Ardından kartını seçebilirsin.');
    }
    let success = false;
    try { success = await speak(target); } catch { success = false; }
    if (epoch !== speechEpoch || current !== taskUi) return;
    root.querySelector('[data-learning="listen"]')?.setAttribute('aria-busy', 'false');
    root.querySelectorAll('[data-learning="choice"]').forEach(button => { button.disabled = false; });
    if (success !== true) {
      countHint();
      feedback('Bu kelimenin Türkçe sesi bu cihazda çalınamadı. Bir büyüğün kelimeyi okuyabilir; örneği de açabilirsin.', 'help');
    } else { current.audioPlayed = true; feedback('Dinledin. Hazır olduğunda kartını seçebilirsin.'); }
  }
  function next() {
    const state = snapshot();
    const task = currentTask(state);
    if (!task || !draftFor(state, task).correct) return;
    persist({ ...state, session: { ...state.session, index: state.session.index + 1 } });
    if (state.session.index + 1 >= state.session.tasks.length) renderSummary();
    else renderTask();
  }
  function renderPause() {
    stop();
    const state = snapshot();
    if (state.session) persist({ ...state, session: { ...state.session, paused: true } });
    const section = root.querySelector('#learning');
    if (!section) return;
    const existing = root.querySelector('#learningPause');
    if (existing) return;
    const dialog = document.createElement('div');
    dialog.id = 'learningPause'; dialog.className = 'learn-pause';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'learningPauseTitle');
    dialog.innerHTML = `<div><span aria-hidden="true">🌿</span><h2 id="learningPauseTitle">Küçük bir mola</h2><p>Kaldığın yer kaydedildi. Ellerini dinlendir; hazır olduğunda devam edebilirsin.</p>${control('resume', 'Kaldığım yerden devam et', '', 'primary')}${control('home', 'Adaya dön', '', 'quiet')}</div>`;
    section.appendChild(dialog);
    dialog.querySelector('button')?.focus();
  }
  function renderSummary() {
    enter('summary');
    const state = snapshot();
    const session = state.session;
    const results = Object.values(session?.results || {}).filter(result => result.correct);
    const independent = results.filter(result => result.independent && !result.hints && !result.mistakes).length;
    const texts = session?.wordTexts || [];
    root.innerHTML = `<section id="learning" class="learning" data-screen="summary">${nav()}${sceneMarkup('complete', session)}<div id="learningSummary" class="learn-summary"><span class="learn-eyebrow">Bugünkü küçük yolculuk tamam</span><h1>Birlikte yeni adımlar attık!</h1><p>${results.length} görevde ${texts.map(escape).join(', ')} kelimeleriyle çalıştın.</p><div class="learn-summary-cards"><div><b>${independent}</b><span>Örneksiz ve yardımsız tamamlanan görev</span></div><div><b>${results.length - independent}</b><span>Birlikte veya ipucuyla tamamlanan görev</span></div></div><p>Bu kelimeler sonraki günlerde yeni görevlerle geri gelecek. Bugünlük mola verebilir veya adada serbestçe oynayabilirsin.</p><div class="learn-actions">${control('home', 'Adama dön', '', 'primary')}${control('parent', 'Birlikte gelişimimize bakalım', '', 'quiet')}${control('new-session', 'Yeni bir kısa yolculuk', '', 'quiet')}</div></div></section>`;
    mountScene();
    window.scrollTo(0, 0);
  }
  function reportRows(state) {
    const list = activeList(state);
    if (!list?.words?.length) return '<p>Bir kelime listesi ekleyince çalışmalar burada görünecek.</p>';
    const summary = summarizeLearning(state, getLetters());
    return list.words.map(word => {
      const summaryWord = summary.words.find(item => item.text === word.text);
      const attemptCount = summaryWord?.skills.reduce((sum, skill) => sum + skill.attempts, 0) || 0;
      return `<details class="learn-word-report"><summary><strong>${escape(word.text)}</strong><span>${attemptCount ? `${attemptCount} kayıtlı deneme` : 'Henüz çalışılmadı'}</span></summary><div class="learn-skill-grid">${SKILLS.map(skill => {
        const progress = summaryWord?.skills.find(item => item.key === skill);
        const titles = { new: 'Henüz gözlem yok', supported: 'Destekle yeniden çalışılacak', independent: 'Yardımsız denendi', 'recalled-later': 'Başka bir günde yardımsız hatırladı' };
        const title = titles[progress?.status] || 'Çalışmaya devam ediyor';
        return `<div><b>${escape(SKILL_NAMES[skill] || skill)}</b><span>${title}</span>${progress?.nextDueAt ? `<small>${escape(dateLabel(progress.nextDueAt))}</small>` : ''}</div>`;
      }).join('')}</div></details>`;
    }).join('');
  }
  function letterReport(state) {
    const rows = summarizeLearning(state, getLetters()).letterRows || [];
    const status = { new: 'Henüz gözlem yok', supported: 'Destekle yeniden çalışılacak', independent: 'Yardımsız denendi', 'recalled-later': 'Başka bir günde yardımsız hatırladı' };
    return `<details class="learn-panel"><summary>Çalıştığımız harfler — yazma ve kart sıralama</summary><p>Harf kartını sıraya koymak ve harfi yazmak ayrı gözlemlerdir. Bu kayıtlar harfin sesini bildiğine dair otomatik bir değerlendirme değildir.</p>${rows.map(row => `<details class="learn-word-report"><summary><strong>${escape(row.letter || row.text)}</strong></summary><div class="learn-skill-grid">${row.skills.map(skill => `<div><b>${escape(skill.label)}</b><span>${status[skill.status] || status.new}</span>${skill.nextDueAt ? `<small>${escape(dateLabel(skill.nextDueAt))}</small>` : ''}</div>`).join('')}</div></details>`).join('')}</details>`;
  }
  function renderParent() {
    enter('parent');
    const state = snapshot();
    const list = activeList(state);
    editListId = list?.id || '';
    const { eligible, blocked } = getEligibleWords(state, getLetters());
    const sync = getSyncStatus();
    const syncMessages = { local: 'Bu cihazdaki kayıtlarla çalışılıyor.', saved: 'Gelişim kaydı sunucuya da kaydedildi.', pending: 'Gelişim kaydı sunucuya gönderiliyor.', error: 'Sunucuya henüz ulaşılamadı. Çalışmalar bu cihazda korunuyor.' };
    const syncMessage = typeof sync === 'string' ? sync : sync?.label || syncMessages[sync?.mode] || syncMessages.local;
    root.innerHTML = `<section id="learning" class="learning learning-parent" data-screen="parent">${nav(control('start', 'Çalışmaya dön', '', 'quiet'))}<div class="learn-intro"><span class="learn-eyebrow">Yetişkin alanı</span><h1>Öğretmenin kelimeleri ve gelişim</h1><p>Listeyi siz belirleyin. Görevler çocuğun denemelerine ve okulda öğrendiği harflere göre şekillensin.</p></div>
      <div class="learn-parent-grid"><section class="learn-panel"><h2>Kelime listem</h2><label for="learningListSelect">Çalışılacak liste</label><select id="learningListSelect">${state.lists.map(item => `<option value="${escape(item.id)}" ${item.id === list?.id ? 'selected' : ''}>${escape(item.title)}</option>`).join('')}</select><div class="learn-inline">${control('new-list', 'Yeni liste oluştur', '', 'quiet')}</div><label for="learningListTitle">Listenin adı</label><input id="learningListTitle" maxlength="80" value="${escape(list?.title || '')}" placeholder="Örneğin: Bu haftanın kelimeleri"><label for="learningWords">Kelimeler — her satıra bir kelime</label><textarea id="learningWords" rows="7" maxlength="6000" spellcheck="false" placeholder="nane&#10;anne&#10;tane">${escape(list?.words.map(word => word.text).join('\n') || '')}</textarea><p class="learn-small">En fazla 100 kelime. Harfleri ve noktalı/noktasız i biçimlerini yazdığınız gibi koruruz. Liste değişince yeni yolculuk hazırlanır; önceki gözlemler korunur.</p>${control('save-list', 'Listeyi kaydet ve kullan', '', 'primary')}<div id="learningErrors" role="alert" class="learn-editor-status" hidden></div></section>
      <section class="learn-panel"><h2>Okulda öğrendiğimiz harfler</h2><p class="learn-known-letters">${getLetters().map(escape).join(' · ')}</p>${control('settings', 'Öğrenilen harfleri düzenle', '', 'quiet')}<p>${eligible.length} kelime şu an çalışılabilir.</p>${blocked.length ? `<div class="learn-blocked"><strong>Harfleri öğrenildiğinde katılacak kelimeler</strong>${blocked.map(word => `<p><b>${escape(word.text)}</b> — eksik harfler: ${word.missingLetters.map(escape).join(', ')}</p>`).join('')}</div>` : '<p class="learn-small">Listedeki bütün kelimeler seçili harflere uygun.</p>'}<p class="learn-small">Harfler otomatik açılmaz. Öğretmeninizin işlediği harfleri seçin.</p><div class="learn-sync-status" role="status">${escape(syncMessage)}</div></section></div>
      <details class="learn-panel learn-authoring"><summary>Hece, anlam ve cümleleri düzenle</summary><p>Hece önerilerini öğretmeninizin verdiği biçime göre düzeltebilirsiniz. Anlam ve cümle isteğe bağlıdır. Cümle görevleri yalnızca seçili harflerle uygunsa hazırlanır.</p><div id="learningWordDetails">${detailRows(list?.words || [])}</div>${control('save-details', 'Kelime ayrıntılarını kaydet', '', 'primary')}</details>
      <section class="learn-panel learn-progress-panel"><h2>Nerede desteğe ihtiyaç duyuyor?</h2><p>Bu kayıtlar etkinliklerdeki gözlemlerdir. Yazma, birlikte kontrol edilmeden doğrulanmaz. Bir kez tamamlanan görev, kalıcı öğrenme olarak işaretlenmez.</p>${reportRows(state)}</section>${letterReport(state)}
    </section>`;
    if (parentDraft && parentDraft.baseListId === list?.id) {
      editListId = parentDraft.id;
      root.querySelector('#learningListTitle').value = parentDraft.title;
      root.querySelector('#learningWords').value = parentDraft.words;
      for (const [word, details] of Object.entries(parentDraft.details)) {
        const field = [...root.querySelectorAll('.learn-word-edit')].find(element => element.dataset.word === word);
        if (!field) continue;
        for (const [key, value] of Object.entries(details)) {
          const input = field.querySelector(`[data-detail="${key}"]`); if (input) input.value = value;
        }
      }
    }
    parentDraft = null;
    window.scrollTo(0, 0);
  }
  function detailRows(words) {
    return words.map(word => `<fieldset class="learn-word-edit" data-word="${escape(word.text)}"><legend>${escape(word.text)}</legend><label>Hece ayrımı<input data-detail="parts" value="${escape(word.parts.join('-'))}" maxlength="50" placeholder="na-ne"></label><label>Kısa anlamı<input data-detail="meaning" value="${escape(word.meaning || '')}" maxlength="160" placeholder="Örneğin: Güzel kokan yeşil bir bitki"></label><label>Örnek cümle<input data-detail="sentence" value="${escape(word.sentence || '')}" maxlength="160" placeholder="Örneğin: Anne nane al."></label></fieldset>`).join('');
  }
  function saveList() {
    const state = snapshot();
    const title = root.querySelector('#learningListTitle')?.value.trim();
    const text = root.querySelector('#learningWords')?.value || '';
    const parsed = parseWordList(text);
    if (!title) { reportParent('Listeye bir ad verin.', true); return; }
    if (/[<>]/.test(title)) { reportParent('Liste adını HTML işaretleri kullanmadan düz metin olarak yazın.', true); return; }
    if (parsed.errors.length) { reportParent(parsed.errors.map(error => `${error.line}. satır: ${error.message}`).join('\n'), true); return; }
    if (!parsed.words.length) { reportParent('En az bir kelime yazın.', true); return; }
    const previous = state.lists.find(list => list.id === editListId);
    if (!previous && state.lists.length >= 20) { reportParent('En fazla 20 liste saklanabilir. Mevcut bir listeyi düzenleyebilirsiniz.', true); return; }
    const otherWords = state.lists.filter(item => item.id !== previous?.id).reduce((total, item) => total + item.words.length, 0);
    if (otherWords + parsed.words.length > 1000) { reportParent('Bütün listelerde toplam en fazla 1000 kelime saklanabilir. Mevcut bir listeyi kısaltıp yeniden deneyin.', true); return; }
    const words = parsed.words.map(word => previous?.words.find(item => item.text === word.text) || word);
    const list = { id: previous?.id || uid(), title, words, updatedAt: Date.now() };
    const lists = previous ? state.lists.map(item => item.id === previous.id ? list : item) : [...state.lists, list];
    persist({ ...state, lists, activeListId: list.id, session: null });
    parentDraft = null;
    renderParent();
    reportParent('Kelime listeniz kaydedildi. Yolculuk bu listeyle hazırlanacak.');
  }
  function saveDetails() {
    const state = snapshot();
    const list = activeList(state);
    if (!list) return;
    if (editListId !== list.id || root.querySelector('#learningWords')?.value.trim() !== list.words.map(word => word.text).join('\n')) {
      reportParent('Önce kelime listenizi kaydedin; sonra hece, anlam ve cümlelerini düzenleyin.', true); return;
    }
    const errors = [];
    const words = list.words.map(word => {
      const field = [...root.querySelectorAll('.learn-word-edit')].find(element => element.dataset.word === word.text);
      if (!field) return word;
      const parts = field.querySelector('[data-detail="parts"]').value.trim().normalize('NFC').toLocaleLowerCase('tr-TR').split(/[\s\-–·]+/).filter(Boolean);
      if (!parts.length || parts.join('') !== word.text) errors.push(`${word.text}: heceler birleşince kelimenin kendisini vermeli.`);
      const meaning = field.querySelector('[data-detail="meaning"]').value.trim();
      const sentence = field.querySelector('[data-detail="sentence"]').value.trim();
      if (/[<>]/.test(meaning + sentence)) errors.push(`${word.text}: anlamı ve cümleyi HTML işaretleri kullanmadan düz metin olarak yazın.`);
      return { ...word, parts, meaning, sentence };
    });
    if (errors.length) { reportParent(errors.join('\n'), true); root.querySelector('#learningErrors')?.scrollIntoView({ block: 'center' }); return; }
    const updated = { ...list, words, updatedAt: Date.now() };
    persist({ ...state, lists: state.lists.map(item => item.id === list.id ? updated : item), session: null });
    parentDraft = null;
    renderParent(); reportParent('Hece, anlam ve cümleler kaydedildi.');
  }
  function change(event) {
    if (event.target.id !== 'learningListSelect') return;
    const state = snapshot();
    if (!state.lists.some(list => list.id === event.target.value)) return;
    persist({ ...state, activeListId: event.target.value, session: null });
    renderParent();
  }
  function click(event) {
    const button = event.target.closest('[data-learning]');
    if (!button || button.disabled || !root.contains(button)) return;
    const action = button.dataset.learning;
    playEffect('tap');
    if (action === 'home') { destroy(); onHome(); }
    else if (action === 'parent') renderParent();
    else if (action === 'start') start();
    else if (action === 'begin-tasks') {
      const state = snapshot();
      if (state.session) persist({ ...state, session: { ...state.session, storySeen: true } });
      renderTask();
    }
    else if (action === 'settings') { destroy(); onOpenSettings(); }
    else if (action === 'pause') renderPause();
    else if (action === 'resume') {
      const state = snapshot(); persist({ ...state, session: { ...state.session, paused: false } }); renderTask();
    } else if (action === 'new-session') {
      const state = snapshot(); persist({ ...state, session: null }); start();
    } else if (action === 'next') next();
    else if (action === 'listen') void playTask();
    else if (action === 'adult-read' && taskUi && !taskUi.result.correct) {
      speechEpoch++; stopSpeech();
      root.querySelector('[data-learning="listen"]')?.setAttribute('aria-busy', 'false');
      countHint(); taskUi.model = true; showModel(); taskUi.audioPlayed = true;
      root.querySelectorAll('[data-learning="choice"]').forEach(item => { item.disabled = false; });
      feedback('Bir büyüğün kelimeyi okuyabilir. Birlikte okuduktan sonra kartını seç. Bu deneme destekli kaydedilecek.', 'help');
    }
    else if (action === 'show-model' && taskUi) {
      if (!taskUi.model) countHint(); taskUi.model = !taskUi.model; showModel();
    } else if (action === 'choice' && taskUi && !taskUi.result.correct) {
      const task = taskUi.task;
      if (task.kind === 'listen' && !taskUi.audioPlayed) {
        feedback('Önce siparişi dinleyelim. Sonra duyduğun kelimeyi seç.', 'help'); return;
      }
      if (button.dataset.value === String(task.target)) { button.classList.add('correct'); finishTask(); }
      else { button.classList.add('tried'); wrong(); }
    } else if (action === 'tile' && taskUi && !taskUi.result.correct) {
      if (taskUi.letterChoice && !taskUi.audioPlayed && !taskUi.model) {
        feedback('Önce harfi dinleyelim veya örneği birlikte açalım.', 'help'); return;
      }
      const tile = taskUi.bank.find(item => item.id === Number(button.dataset.id));
      if (!tile || taskUi.selected.some(item => item.id === tile.id)) return;
      const expected = taskUi.task.tokens?.[taskUi.selected.length] ?? (taskUi.task.kind === 'syllables' ? taskUi.task.parts?.[taskUi.selected.length] : [...taskUi.task.word][taskUi.selected.length]);
      if (tile.text !== expected) { wrong(); observeLetter(taskUi.selected.length, expected, false); return; }
      observeLetter(taskUi.selected.length, expected, true);
      taskUi.selected.push(tile); renderTokens();
      if (taskUi.selected.length === taskUi.expectedTokens.length) finishTask();
      else feedback('Parçanı yerleştirdin. Sıradaki parçayı seçebilirsin.');
    } else if ((action === 'undo' || action === 'restart') && taskUi && !taskUi.result.correct) {
      if (action === 'undo') taskUi.selected.pop(); else { taskUi.selected = []; taskUi.bank = shuffle(taskUi.bank); }
      renderTokens(); feedback('Hazır olduğunda yeniden deneyebilirsin.');
    } else if (action === 'clear' && taskUi && !taskUi.result.correct) {
      const ink = root.querySelector('#learningInk'); if (ink) ink.innerHTML = ''; taskUi.inkLength = 0;
      saveDraft({ inkPaths: [] });
      const review = root.querySelector('#learningReview'); if (review) review.hidden = true;
      feedback('Yazı alanın hazır.');
    } else if (action === 'review' && taskUi && !taskUi.result.correct) {
      if (taskUi.inkLength < 15) { feedback('Önce yazı alanına yazmayı dene.', 'help'); return; }
      const review = root.querySelector('#learningReview'); review.hidden = false; review.querySelector('button')?.focus();
    } else if (action === 'approve' && taskUi && !taskUi.result.correct && taskUi.inkLength >= 15 && !root.querySelector('#learningReview')?.hidden) {
      root.querySelector('#learningReview').hidden = true; finishTask({ writingReviewed: true });
    } else if (action === 'retry-writing' && taskUi) {
      root.querySelector('#learningReview').hidden = true; countHint(); feedback('Birlikte harflerine bakalım; sonra yeniden deneyebilirsin.', 'help');
    } else if (action === 'letter-help' && taskUi) {
      countHint(); const letter = taskUi.task.word[0]; destroy(); onPracticeLetter(letter);
    } else if (action === 'save-list') saveList();
    else if (action === 'save-details') saveDetails();
    else if (action === 'new-list') {
      editListId = ''; root.querySelector('#learningListTitle').value = ''; root.querySelector('#learningWords').value = '';
      root.querySelector('#learningListTitle').focus(); reportParent('Yeni listenizin adını ve kelimelerini yazın.');
    }
  }
  function destroy() {
    if (screen === 'parent') {
      const details = {};
      root.querySelectorAll('.learn-word-edit').forEach(field => {
        details[field.dataset.word] = Object.fromEntries([...field.querySelectorAll('[data-detail]')].map(input => [input.dataset.detail, input.value]));
      });
      parentDraft = {
        baseListId: activeList(snapshot())?.id,
        id: editListId, title: root.querySelector('#learningListTitle')?.value || '',
        words: root.querySelector('#learningWords')?.value || '', details,
      };
    }
    stop();
    if (listening) { root.removeEventListener('click', click); root.removeEventListener('change', change); }
    listening = false;
    screen = '';
    taskUi = null;
  }
  function resume() {
    if (lastScreen === 'parent') renderParent();
    else if (lastScreen === 'summary') renderSummary();
    else if (lastScreen === 'intro' && snapshot().session) renderIntro();
    else if (lastScreen === 'task') start();
    else renderHome();
  }
  function reset() { destroy(); }
  return { renderHome, start, renderParent, destroy, resume, reset, get screen() { return screen; } };
}
