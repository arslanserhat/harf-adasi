import './styles.css';
import './writing.css';
import './upgrade.css';
import './home.css';
import '@fontsource-variable/nunito-sans';
import './theme.css';
import { mountWorldAmbience } from './world-ambience.js';
import { audio, configureAudio } from './audio.js';
import { mountWritingGuard, releaseWritingGuard } from './writing.js';
import { mountVisuals } from './visuals.js';
import { syncCompletion, resetServerProgress, loadServerProgress } from './progress-sync.js';
import { chooseAdventure, getAdventureActivityKey } from './adventures.js';
import { createIsland } from './island.js';
import { normalizeIslandCompletion, getIslandActivityKey } from './island-model.js';
import { showCelebration, hideCelebration } from './celebration.js';
import { createLearning } from './learning.js';
import { createLearningStore } from './learning-sync.js';
import { recordAttempt, planSession } from './learning-model.js';
import { createIcons, Volume2, VolumeX, Settings2, Star, ArrowLeft, Play, Pause, Check, RotateCcw, CheckCircle2, ArrowRight, X } from 'lucide';
import './mobile.css';
import { mountPlayerViewport } from './player-viewport.js';
import { createQuests } from './quests.js';
import { recommendQuestKind } from './quest-model.js';
import { renderQuestDestinations } from './quest-home.js';
import { getTeacherLibrary, getTeacherReadingOptions, renderTeacherLibrary, renderTeacherRoute, teacherSentenceKey } from './teacher-library.js';
import './teacher-library.css';
import { createContentStore, orderContentPool } from './content-selection.js';
import { mountChildProfiles, renderProfileControls } from './child-profile.js';
import './child-profile.css';

const UI_ICONS = { Volume2, VolumeX, Settings2, Star, ArrowLeft, Play, Pause, Check, RotateCcw, CheckCircle2, ArrowRight, X };
function refreshIcons() { if (document.querySelector('i[data-lucide]')) createIcons({ icons: UI_ICONS }); }
new MutationObserver(refreshIcons).observe(document.body, { childList: true, subtree: true });
mountVisuals(document.body);
mountWorldAmbience({ root: document.body });
mountChildProfiles({ root: document.body });
mountPlayerViewport();
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
document.addEventListener('keydown', () => audio.unlock(), { passive: true });

'use strict';
window.HARF_ADASI_READY=false;window.HARF_ADASI_VERSION='5.5.0';
function report(e){document.getElementById('error').hidden=false;document.getElementById('errorText').textContent=String(e&&e.message||e);document.getElementById('ready').textContent='Başlatma sorunu';}
window.addEventListener('error',e=>report(e.error||e.message));window.addEventListener('unhandledrejection',e=>report(e.reason));
(()=>{try{
const A='a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' '),$=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const P={
a:['M252 152C232 128 184 128 159 154C129 184 135 239 163 260C192 281 233 267 252 241C263 216 263 177 252 152','M255 137L255 270'],
b:['M145 60L145 270','M145 199C145 160 168 135 201 135C239 135 260 162 260 202C260 242 239 270 201 270C169 270 145 246 145 221'],
c:['M255 156C235 135 208 130 184 138C153 147 140 170 140 204C140 244 165 270 200 270C223 270 242 262 255 247'],
d:['M255 160C232 129 190 128 163 148C133 170 131 224 155 252C182 284 229 272 255 244','M255 60L255 270'],
e:['M142 198L257 198C257 160 236 135 202 135C163 135 140 164 140 203C140 244 165 270 204 270C226 270 245 260 257 246'],
f:['M249 72C235 58 216 56 202 67C186 80 185 101 185 126L185 270','M144 146L240 146'],
g:['M250 154C228 128 184 129 159 154C132 182 135 232 159 254C184 280 229 270 250 241','M253 137L253 280C253 308 233 325 205 325C183 325 168 318 156 307'],
h:['M148 60L148 270','M148 192C154 155 176 135 206 135C238 135 253 157 253 190L253 270'],
ı:['M200 135L200 270'],i:['M200 135L200 270','M200 87L200 90'],
j:['M217 135L217 278C217 309 201 325 179 325C169 325 162 321 156 315','M217 87L217 90'],
k:['M147 60L147 270','M253 135L148 211','M185 184L261 270'],l:['M200 60L200 270'],
m:['M111 135L111 270','M111 190C114 155 130 135 151 135C181 135 198 154 198 184L198 270','M198 190C201 155 219 135 242 135C272 135 289 154 289 184L289 270'],
n:['M148 135L148 270','M148 190C154 155 176 135 206 135C238 135 253 157 253 190L253 270'],
o:['M201 135C164 135 140 163 140 202C140 242 164 270 201 270C238 270 262 242 262 202C262 163 238 135 201 135'],
p:['M145 135L145 325','M145 196C145 160 168 135 201 135C239 135 260 162 260 202C260 242 239 270 201 270C169 270 145 246 145 222'],
r:['M165 135L165 270','M165 188C172 150 198 130 230 138'],
s:['M249 152C230 134 200 130 177 138C150 146 143 170 161 187C179 204 225 204 242 222C264 246 238 270 205 270C178 270 157 260 144 247'],
t:['M191 77L191 232C191 258 204 270 224 270C236 270 243 266 249 261','M145 144L246 144'],
u:['M147 135L147 216C147 251 163 270 194 270C224 270 249 250 253 216','M253 135L253 270'],
v:['M140 135L200 270L260 135'],y:['M140 135L201 270','M260 135L195 282C183 309 173 325 151 325'],z:['M146 135L254 135L146 270L254 270'],
A:['M115 270L200 60L285 270','M151 184L249 184'],B:['M133 60L133 270','M133 60L205 60C280 60 282 161 205 161L133 161','M133 161L213 161C291 161 289 270 213 270L133 270'],C:['M278 86C250 48 184 48 147 84C101 127 105 217 147 251C185 283 247 280 278 244'],D:['M133 60L133 270','M133 60L190 60C310 60 310 270 190 270L133 270'],E:['M264 60L137 60L137 270L264 270','M137 163L246 163'],F:['M264 60L137 60L137 270','M137 163L246 163'],G:['M278 86C250 48 184 48 147 84C101 127 105 217 147 251C185 283 247 280 278 244L278 176L209 176'],H:['M132 60L132 270','M268 60L268 270','M132 164L268 164'],I:['M200 60L200 270'],J:['M255 60L255 215C255 287 139 291 132 219'],K:['M135 60L135 270','M275 60L135 179','M193 130L281 270'],L:['M143 60L143 270L267 270'],M:['M105 270L105 60L200 195L295 60L295 270'],N:['M130 270L130 60L270 270L270 60'],O:['M200 60C93 60 93 270 200 270C307 270 307 60 200 60'],P:['M135 270L135 60L207 60C293 60 293 169 207 169L135 169'],R:['M135 270L135 60L207 60C293 60 293 169 207 169L135 169','M203 169L281 270'],S:['M270 85C236 47 168 50 142 88C102 150 235 166 262 202C309 268 185 298 133 250'],T:['M110 60L290 60','M200 60L200 270'],U:['M132 60L132 196C132 296 268 296 268 196L268 60'],V:['M118 60L200 270L282 60'],Y:['M115 60L200 166L285 60','M200 166L200 270'],Z:['M125 60L275 60L125 270L275 270'],
'0':['M200 60C116 60 116 270 200 270C284 270 284 60 200 60'],'1':['M156 102L205 60L205 270'],'2':['M133 113C138 44 264 41 266 107C268 154 186 202 132 270L272 270'],'3':['M137 79C186 40 271 61 264 112C259 152 221 164 190 164C226 158 274 180 272 218C268 280 180 287 133 250'],'4':['M232 60L124 207L278 207','M234 60L234 270'],'5':['M267 60L145 60L137 158C209 124 276 155 270 218C266 277 187 290 135 252'],'6':['M258 75C175 22 130 113 130 195C130 287 271 296 271 208C271 131 149 127 131 198'],'7':['M126 60L278 60L169 270'],'8':['M200 60C109 60 123 146 200 164C292 187 295 270 200 270C105 270 108 187 200 164C277 146 291 60 200 60'],'9':['M270 140C270 31 129 35 129 130C129 218 270 211 270 130L270 191C270 264 224 295 158 258']};
[['ç','c',['M203 283L192 297C221 293 222 318 198 323L182 321']],['ğ','g',['M171 77C176 111 224 111 229 77']],['ö','o',['M173 87L173 90','M230 87L230 90']],['ş','s',['M203 283L192 297C221 293 222 318 198 323L182 321']],['ü','u',['M173 87L173 90','M230 87L230 90']],['Ç','C',['M205 284L193 298C221 293 220 320 193 322']],['Ğ','G',['M175 20C180 48 222 48 227 20']],['İ','I',['M200 25L200 28']],['Ö','O',['M169 25L169 28','M231 25L231 28']],['Ş','S',['M205 284L193 298C221 293 220 320 193 322']],['Ü','U',['M169 25L169 28','M231 25L231 28']]].forEach(([c,b,extra])=>P[c]=[...P[b],...extra]);
const syllables='an en in un al el il ol at et it ot ta te ti to na ne ni no la le li lo ma me mi mu ar er ir or ra re ri ru ka ke ki ku ak ek ik ok sa se si su'.split(' ');
const words=`anne|an-ne|👩;nine|ni-ne|👵;nane|na-ne|🌿;lale|la-le|🌷;el|el|✋;at|at|🐎;et|et|🥩;okul|o-kul|🏫;kalem|ka-lem|✏️;kitap|ki-tap|📖;elma|el-ma|🍎;armut|ar-mut|🍐;muz|muz|🍌;limon|li-mon|🍋;kiraz|ki-raz|🍒;çilek|çi-lek|🍓;üzüm|ü-züm|🍇;kavun|ka-vun|🍈;karpuz|kar-puz|🍉;balık|ba-lık|🐟;kedi|ke-di|🐈;köpek|kö-pek|🐕;kuş|kuş|🐦;arı|a-rı|🐝;inek|i-nek|🐄;koyun|ko-yun|🐑;keçi|ke-çi|🐐;tavuk|ta-vuk|🐔;ördek|ör-dek|🦆;aslan|as-lan|🦁;kaplan|kap-lan|🐯;fil|fil|🐘;zebra|zeb-ra|🦓;fare|fa-re|🐭;ayı|a-yı|🐻;kurbağa|kur-ba-ğa|🐸;tilki|til-ki|🦊;zürafa|zü-ra-fa|🦒;ağaç|a-ğaç|🌳;dağ|dağ|⛰️;yağmur|yağ-mur|🌧️;güneş|gü-neş|☀️;ay|ay|🌙;yıldız|yıl-dız|⭐;bulut|bu-lut|☁️;kar|kar|❄️;çiçek|çi-çek|🌼;yaprak|yap-rak|🍃;göz|göz|👁️;kulak|ku-lak|👂;burun|bu-run|👃;ağız|a-ğız|👄;diş|diş|🦷;ayak|a-yak|🦶;ev|ev|🏠;kapı|ka-pı|🚪;sandalye|san-dal-ye|🪑;lamba|lam-ba|💡;saat|sa-at|⏰;şapka|şap-ka|👒;çanta|çan-ta|🎒;çorap|ço-rap|🧦;şemsiye|şem-si-ye|☂️;bisiklet|bi-sik-let|🚲;araba|a-ra-ba|🚗;tren|tren|🚂;gemi|ge-mi|🚢;uçak|u-çak|✈️;jet|jet|🛩️;top|top|⚽;balon|ba-lon|🎈;ekmek|ek-mek|🍞;süt|süt|🥛;su|su|💧;peynir|pey-nir|🧀;yumurta|yu-mur-ta|🥚;biber|bi-ber|🫑;havuç|ha-vuç|🥕;etti|et-ti|✍️;inat|i-nat|💭`.split(';').map(row=>{const [text,split,emoji]=row.split('|');return{text,parts:split.split('-'),emoji,read:!['etti','inat'].includes(text)}});
const sentences=['Ali gel.','Ela elma al.','Anne nane al.','Nine eve gel.','Lale top al.','Ege kitap oku.','Kedi süt içer.','Kuş uçtu.','Arı bal yapar.','Baba su iç.','Mete kalem al.','Oya okula git.','İnek ot yer.','Ada balon al.','Güneş doğdu.','Ali ve Ela oynadı.','İnan inat etti.'];
const rewards=[['🌱','Minik filiz'],['🦁','Cesur kaşif'],['🌈','Gökkuşağı'],['🦋','Renkli kanatlar'],['🌻','Güneş çiçeği'],['🐢','Kendi hızında'],['🐬','Deniz arkadaşı'],['⭐','Parlayan yıldız'],['🦉','Bilge baykuş'],['🐞','Uğur böceği'],['🏝️','Ada gezgini'],['👑','Keşif tacı']];
const modes=[['letters','✏️','Harfi çiz','29 harf · Büyük ve küçük'],['syllables','🚂','Hece yap','Harfleri birleştir'],['words','🧩','Kelime yap','Resimli kelimeler'],['reading','🦉','Oku ve bul','Doğru resmi seç'],['sentences','🌈','Cümle kur','Kelimeleri sırala'],['numbers','🎈','Say ve bul','0–100 ile keşfet']];
const lion=`<svg viewBox="0 0 240 190" fill="none" aria-hidden="true"><ellipse cx="121" cy="177" rx="73" ry="10" fill="#24536A" opacity=".12"/><g stroke="#A36739" stroke-width="4" stroke-linejoin="round"><path d="M87 124q-14 27-6 43 35 17 76 0 6-27-15-43" fill="#FFD071"/><path d="M151 147q30 9 35-10" stroke="#EAA34C" stroke-width="12" stroke-linecap="round"/><circle cx="188" cy="134" r="9" fill="#BF7D40"/><ellipse cx="87" cy="168" rx="19" ry="11" fill="#FFE0A0"/><ellipse cx="146" cy="168" rx="19" ry="11" fill="#FFE0A0"/><path d="M77 130q-17 5-27-16m96 19 22-18" stroke="#E8A74E" stroke-width="17" stroke-linecap="round"/><path d="M172 121c-15-1-14-16-12-24 1-7 8-6 10 0 1-13 9-12 10-2 5-10 12-7 10 2 11-5 16 3 8 12-8 9-17 14-26 12" fill="#FFD67D"/></g><path d="M63 30C52 13 77 1 90 12 101-6 124-4 133 11 153 0 172 17 163 34 187 37 195 60 177 74 193 93 179 115 159 111 154 135 130 145 116 127 97 145 75 132 74 115 50 123 35 101 47 84 25 71 32 46 53 45Z" fill="#E9A04E" stroke="#B8783F" stroke-width="4"/><circle cx="67" cy="40" r="15" fill="#FFD486" stroke="#B8783F" stroke-width="3"/><circle cx="159" cy="40" r="15" fill="#FFD486" stroke="#B8783F" stroke-width="3"/><ellipse cx="114" cy="70" rx="54" ry="51" fill="#FFDF93"/><ellipse cx="114" cy="93" rx="30" ry="23" fill="#FFF1C9"/><ellipse cx="93" cy="65" rx="8" ry="11" fill="#5E4437"/><ellipse cx="137" cy="65" rx="8" ry="11" fill="#5E4437"/><circle cx="96" cy="61" r="3" fill="white"/><circle cx="140" cy="61" r="3" fill="white"/><ellipse cx="79" cy="83" rx="10" ry="6" fill="#F6A18C"/><ellipse cx="151" cy="83" rx="10" ry="6" fill="#F6A18C"/><path d="M106 85q8-6 16 0l-8 9Z" fill="#80503B"/><path d="M114 94v4m-13 0q13 17 26 0" stroke="#80503B" stroke-width="3" stroke-linecap="round"/><path d="m91 136 23 16 23-16" fill="#6CBCA6" stroke="#428A7C" stroke-width="3"/></svg>`;
const STORE='harf-adasi-github-v3';let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch(_){}if(typeof saved!=='object')saved={};
const state={done:Array.isArray(saved.done)?[...new Set(saved.done.filter(x=>typeof x==='string'))].slice(0,5000):[],letters:Array.isArray(saved.letters)?saved.letters.filter(x=>A.includes(x)):['a','n','e','t','i','l'],muted:saved.muted===true,effects:saved.effects!==false,volume:typeof saved.volume==='number'?Math.max(0,Math.min(1,saved.volume)):.85,hint:saved.hint!==false,motionPaused:saved.motionPaused===true,recent:A.includes(saved.recent)?saved.recent:'a',recentAdventure:typeof saved.recentAdventure==='string'?saved.recentAdventure.slice(0,80):''};if(!state.letters.length)state.letters=['a','n','e','t','i','l'];
document.body.dataset.motionPaused=String(state.motionPaused);
configureAudio({onStatus:message=>toast(message),muted:state.muted,volume:state.volume,effects:state.effects});audio.preload();
let progressEpoch=0;
const freshProgress=new Set();
let view='home',filter='all',caps=false,numMode='trace',game=null,raf=0,timer=0,learning=null,quests=null;
const QUEST_STORE='harf-adasi-quests-v1';
let questHistory={version:1,runs:[],active:null};
try{const raw=localStorage.getItem(QUEST_STORE);const parsed=raw&&raw.length<2000000?JSON.parse(raw):null;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))questHistory={version:1,runs:Array.isArray(parsed.runs)?parsed.runs.slice(-100):[],active:parsed.active&&typeof parsed.active==='object'?parsed.active:null}}catch{}
function saveQuestHistory(next){questHistory=next;try{localStorage.setItem(QUEST_STORE,JSON.stringify(next))}catch{toast('Macera bu oturumda açık kalacak; bu tarayıcı kaydı saklayamıyor.')}}
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shuffle(xs){let a=xs.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,4300)}
function header(){$('#badge').textContent=Math.min(rewards.length,state.done.length+questHistory.runs.filter(run=>run?.completed===true&&run.completedStages===6).length);$('#sound').innerHTML=state.muted?'<i data-lucide="volume-x"></i>':'<i data-lucide="volume-2"></i>';audio.setMuted(state.muted);audio.setVolume(state.volume);audio.setEffectsEnabled(state.effects);$('#sound').setAttribute('aria-label',state.muted?'Sesi aç':'Sesi kapat');$('#sound').setAttribute('aria-pressed',String(!state.muted))}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(_){toast('İlerleme kaydedilemiyor. Oynamaya devam edebilirsin.')}header()}
function stop(){island?.destroy();quests?.destroy();if(learning?.screen)learning.destroy();hideCelebration();cancelAnimationFrame(raf);raf=0;game?.trace?.stopDemo?.();audio.stopSpeech()}
function speak(t){if(state.muted){toast('Ses kapalı. Hoparlöre dokunabilirsin.');return}return audio.speak(String(t))}
const island=createIsland({
  root:$('#main'),getLetters:()=>state.letters,getCompleted:()=>state.done,
  getContentState:()=>contentStore.getState(),onContentExposure:event=>contentStore.expose(event),
  speak,isMuted:()=>state.muted,stopSpeech:()=>audio.stopSpeech(),
  celebrate:options=>showCelebration({...options,effects:state.effects}),
  onComplete:mission=>{
    const placement=mission.zone==='treasure'&&['beach','garden','station'].includes(mission.placement)?':'+mission.placement:'';
    const companion=mission.zone==='care'&&['cat','dog','bird'].includes(mission.companion)?':'+mission.companion:'';
    const key=mission.key+placement+companion;
    const attempt={type:'island',key,startedAt:mission.startedAt??performance.now(),writingReviewed:false};
    const primary='island:'+mission.key;
    freshProgress.add(primary);
    // Replaying moves this mission to the end and may move its decoration.
    state.done=state.done.filter(item=>item!==primary&&!item.startsWith(primary+':'));
    state.done.push('island:'+key);
    save();syncCompletion(attempt);
  },
  onExit:()=>go(),
});
const learningStore=createLearningStore({onRemoteChange:(_snapshot,reason)=>{
  if(reason==='reset'){contentStore.reset();quests?.destroy();saveQuestHistory({version:1,runs:[],active:null});if(view==='learning'||view==='learning-parent'||view==='quest'){go();toast('Öğrenme kaydı başka bir pencerede sıfırlandı.');return}}
  if(reason==='merged'&&(view==='learning'||view==='learning-parent'))learning?.resume?.();
  if(view==='home')home();
  else if(['syllables','words','reading','sentences'].includes(view))catalog();
}});
// Migrate only content actually identified by old completions/progress. An
// edited word's current syllables cannot reconstruct what was served earlier.
function priorContentSeed(learner){
  const seed={letters:[],syllables:[],words:[],sentences:[],numbers:[],activities:[]};
  for(const item of state.done){
    const [kind,...parts]=item.split(':'),key=parts.join(':');
    if(kind==='letter')seed.letters.push(key);
    else if(['digit','count','number'].includes(kind))seed.numbers.push(key);
    else if(kind==='syllable')seed.syllables.push(key);
    else if(kind==='word'||kind==='reading')seed.words.push(key);
    else if(kind==='sentence'&&/^\d+$/.test(key)&&sentences[Number(key)])seed.sentences.push(sentences[Number(key)]);
    else if(kind==='adventure'){const id=getAdventureActivityKey(key);if(id)seed.activities.push(id)}
    else if(kind==='island'){const normalized=normalizeIslandCompletion(item);const id=normalized&&getIslandActivityKey(normalized.slice('island:'.length));if(id)seed.activities.push(id)}
  }
  for(const [text,skills] of Object.entries(learner.progress||{}))if(Object.values(skills).some(skill=>skill?.attempts>0)){
    if(text.length===1)seed.letters.push(text);
    else if((words.some(word=>word.text===text)||learner.lists.some(list=>list.words.some(word=>word.text===text)))&&Object.entries(skills).some(([skill,evidence])=>skill!=='syllables'&&evidence?.attempts>0))seed.words.push(text);
  }
  return seed;
}
const contentStore=createContentStore({seed:priorContentSeed(learningStore.getState())});
learning=createLearning({
  root:$('#main'),getState:learningStore.getState,setState:learningStore.setState,getLetters:()=>state.letters,
  speak,stopSpeech:()=>audio.stopSpeech(),isMuted:()=>state.muted,
  playEffect:name=>{if(state.effects)audio.playEffect(name)},
  effectsEnabled:()=>state.effects,
  onToggleSound:()=>{state.muted=!state.muted;save();if(state.muted)audio.stopSpeech()},
  onHome:()=>go(),onPracticeLetter:c=>letter(c),onOpenSettings:()=>settings(),getSyncStatus:learningStore.getSyncStatus,
  getContentState:()=>contentStore.getState(),onContentExposure:event=>contentStore.expose(event),
});
quests=createQuests({
  root:$('#main'),getLearningState:learningStore.getState,getLetters:()=>state.letters,
  getHistory:()=>questHistory,saveHistory:saveQuestHistory,
  getContentState:()=>contentStore.getState(),onContentExposure:event=>contentStore.expose(event),
  onAttempt:attempt=>learningStore.setState(recordAttempt(learningStore.getState(),attempt)),
  onComplete:()=>header(),onHome:()=>go(),onParent:()=>go('learning-parent'),
  speak,stopSpeech:()=>audio.stopSpeech(),isMuted:()=>state.muted,
  onToggleSound:()=>{state.muted=!state.muted;save();if(state.muted)audio.stopSpeech()},
  playEffect:name=>{if(state.effects)audio.playEffect(name)},getLetterPaths:text=>P[text]||[],
});
function openQuest(kind){releaseWritingGuard();stop();close(false);game=null;view='quest';filter='all';header();quests.start(kind);window.scrollTo(0,0)}
function observeLegacyStep(){
  const s=game?.steps[game.i],observation=game?.observation;
  const observedWord=s?.text?.normalize('NFC').toLocaleLowerCase('tr-TR');
  if(!s||!observation||game.type==='syllable'||game.adventure&&(game.adventure.letterOnly||game.i!==2)||!/^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u.test(observedWord))return;
  const skill=s.kind==='build'?(game.type==='syllable'?'syllables':'build'):s.kind==='read'?'meaning':s.kind==='free'?'write':null;
  if(!skill)return;
  learningStore.setState(recordAttempt(learningStore.getState(),{
    id:observation.id,word:observedWord,skill,correct:true,mistakes:observation.mistakes,hints:observation.hints,
    writingReviewed:s.kind==='free'&&game.writingReviewed===true,
    independent:observation.hints===0&&observation.mistakes===0,at:Date.now(),
  }));
}
function mergeCompletions(items){
  const unique=new Map();
  for(const item of items){
    if(typeof item!=='string')continue;
    const key=item.startsWith('island:')?normalizeIslandCompletion(item):item;
    if(!key)continue;
    unique.delete(key);unique.set(key,item);
  }
  return [...unique.values()].slice(-5000);
}
async function resetProgress(){
  progressEpoch++;
  const control=$('[data-do="confirm-reset"]');
  if(control)control.disabled=true;
  const result=await resetServerProgress();
  if(result===false){
    if(control)control.disabled=false;
    toast('Kayıt silinemedi. Bağlantını kontrol edip yeniden deneyebilirsin.');return;
  }
  if(result?.learning_revision!==undefined)learningStore.acceptReset(result.learning_revision);
  else if(!await learningStore.reset()){toast('Öğrenme kaydı sıfırlanamadı. Yeniden deneyebilirsin.');if(control)control.disabled=false;return}
  quests?.destroy();saveQuestHistory({version:1,runs:[],active:null});
  contentStore.reset();
  state.done=[];freshProgress.clear();save();go();
}
function teacherLibrary(){return getTeacherLibrary(learningStore.getState(),state.letters,words)}
function showIslandTeacherRoute(){
  const shell=$('#island');if(!shell||shell.querySelector('[data-teacher-route]'))return;
  const heading=shell.querySelector('.island-heading')||shell.querySelector('.island-toolbar');
  heading?.insertAdjacentHTML('afterend',renderTeacherRoute(teacherLibrary(),{kind:'syllables',context:'island'}));
}
function openIsland(zone){go('island');if(zone){island.start(zone);showIslandTeacherRoute()}}
function openLearningContext(options={}){
  releaseWritingGuard();stop();close(false);game=null;view='learning';filter='all';header();
  learning.startFresh(options);window.scrollTo(0,0);
}
function toggleHomeMotion(control){
  state.motionPaused=!state.motionPaused;document.body.dataset.motionPaused=String(state.motionPaused);
  const shell=$('.home-shell');if(shell)shell.dataset.motionPaused=String(state.motionPaused);
  const label=state.motionPaused?'Hareketi başlat':'Hareketi durdur';
  control.setAttribute('aria-pressed',String(state.motionPaused));
  control.setAttribute('aria-label',state.motionPaused?'Ada hareketlerini başlat':'Ada hareketlerini durdur');
  const icon=state.motionPaused?'<path d="m8 5 11 7-11 7z"/>':'<path d="M8 5v14M16 5v14"/>';
  control.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span>`;
  save();
}
function numName(n){let o=['sıfır','bir','iki','üç','dört','beş','altı','yedi','sekiz','dokuz'],t=['','on','yirmi','otuz','kırk','elli','altmış','yetmiş','seksen','doksan'];return n===100?'yüz':n<10?o[n]:t[Math.floor(n/10)]+(n%10?' '+o[n%10]:'')}
const actionIcons={home:'arrow-left',speak:'volume-2',demo:'play',pause:'pause',clear:'rotate-ccw',review:'check-circle-2',approve:'check',next:'arrow-right',repeat:'rotate-ccw',close:'x'};
const button=(doWhat,text,attrs='',cls='btn')=>{const name=actionIcons[doWhat];const label=name?String(text).replace(/[🔊🧽▶←→🌿★⭐]/gu,'').trim():text;return `<button class="${cls}" data-do="${doWhat}" ${attrs}>${name?`<i data-lucide="${name}"></i>`:''}${label}</button>`};
function bar(label='Oyun bahçesi'){return `<div class="bar">${button('home','← '+label,'','back')}<span>Kendi hızında 🌿</span></div>`}
function go(v='home'){releaseWritingGuard();stop();close(false);game=null;view=v;filter='all';render();window.scrollTo(0,0)}
function render(){header();if(view==='home')home();else if(view==='island'){island.renderMap();showIslandTeacherRoute()}else if(view==='learning')learning.renderHome();else if(view==='learning-parent')learning.renderParent();else if(view==='stickers')stickerPage();else catalog()}
function home(){
  const learner=learningStore.getState();
  const session=learner.session;
  const activeQuest=questHistory.active?.kind;
  const questKind=['letters','syllables','words','reading','sentences','numbers'].includes(activeQuest)?activeQuest:recommendQuestKind({learningState:learner,letters:state.letters,history:questHistory,now:Date.now()});
  const continuing=Boolean(session?.tasks?.length&&session.index<session.tasks.length);
  const list=learner.lists.find(item=>item.id===learner.activeListId)||learner.lists[0];
  const assetBase=document.querySelector('meta[name="harf-backend"]')?.content==='laravel'?'/':import.meta.env.BASE_URL;
  const listWords=(list?.words||[]).slice(0,4).map(word=>word.text);
  const motionPaused=document.body.dataset.motionPaused==='true'||state.motionPaused===true;
  const mapIcon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='post'?'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>':name==='workshop'?'<path d="M6 17V9a4 4 0 0 1 8 0v8m-8-5h8m4 5V7"/>':name==='bridge'?'<path d="M3 18V8m18 10V8M3 12c6 4 12 4 18 0M3 8c6 4 12 4 18 0M7 11v7m5-6v7m5-8v7"/>':'<path d="M6 18c-7-9 3-16 14-14 1 11-3 17-12 14m-3 3L17 9"/>'}</svg>`;
  const butterfly=`<svg viewBox="0 0 32 28" aria-hidden="true"><g class="home-butterfly-wings"><path d="M15 13C-2-8-6 16 13 17 4 30 21 30 16 16" fill="#e8ad78"/><path d="M17 13C34-8 38 16 19 17 28 30 11 30 16 16" fill="#f6cd91"/></g><path d="M16 9v13m0-11-3-5m3 5 3-5" fill="none" stroke="#927356" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const mapStops=[['post','Postane','Dinle ve kelimeyi bul',50,50],['workshop','Atölye','Harflerle kelimeler kur',78,22],['bridge','Köprü','Öğrendiklerini yeniden hatırla',65,55],['garden','Bahçe','Kelimelerin anlamını keşfet',86,62]];
  $('#main').innerHTML=`<div class="home-shell" data-motion-paused="${motionPaused}">
    <section class="home-island-hero" aria-labelledby="homeAdventureTitle">
      <div class="home-hero-copy"><span class="home-eyebrow"><span></span>HER GÜN YENİ BİR KEŞİF</span><h1 id="homeAdventureTitle">Küçük kelimeler.<br><em>Kocaman maceralar.</em></h1><p>Alparslan ile adayı keşfet.<br>Dinle, kelimeleri birleştir, hikâyenin bir parçası ol.</p>
      <button class="home-primary" data-do="quest-start" data-quest-kind="${esc(questKind)}">${activeQuest?'Maceraya devam et':'Maceraya başla'}<i data-lucide="arrow-right"></i></button>
      <div class="home-hero-note"><span class="home-tiny-check"><i data-lucide="check"></i></span>${activeQuest?`${Math.min(6,(questHistory.active.index||0)+1)}. görevden, kendi dünyandan devam.`:'Bir dünya seç, adada kendi izini bırak.'}</div></div>
      <div class="home-island-art"><img src="${esc(assetBase)}art/harf-island.webp" alt="Alparslan ve arkadaşlarının seni beklediği yemyeşil bir macera adası" width="1672" height="941" fetchpriority="high" decoding="async">
      <div class="home-map-life" aria-hidden="true"><span class="home-sea-ripple home-sea-ripple-one"></span><span class="home-sea-ripple home-sea-ripple-two"></span><span class="home-drifting-cloud home-drifting-cloud-one"></span><span class="home-drifting-cloud home-drifting-cloud-two"></span><span class="home-map-butterfly home-map-butterfly-one">${butterfly}</span><span class="home-map-butterfly home-map-butterfly-two">${butterfly}</span>${['a','n','e'].map((letter,index)=>`<span class="home-floating-letter home-floating-letter-${index+1}">${letter}</span>`).join('')}${[[57,18],[91,35],[46,76],[73,79]].map(([x,y],index)=>`<span class="home-map-sparkle" style="--sparkle-x:${x}%;--sparkle-y:${y}%;--sparkle-delay:${index*1.4}s"></span>`).join('')}</div>
      <div class="home-map-stops" aria-label="Adada gidebileceğin yerler">${mapStops.map(([world,label,description,x,y])=>`<button class="home-map-stop home-map-stop-${world}" data-do="learning-world" data-world="${world}" style="--stop-x:${x}%;--stop-y:${y}%" aria-label="${label}: ${description}" title="${description}"><span class="home-map-stop-icon">${mapIcon(world)}</span><span class="home-map-stop-label">${label}</span></button>`).join('')}</div>
      <button class="home-motion-toggle" data-do="home-motion" aria-pressed="${motionPaused}" aria-label="${motionPaused?'Ada hareketlerini başlat':'Ada hareketlerini durdur'}"><i data-lucide="${motionPaused?'play':'pause'}"></i><span>${motionPaused?'Hareketi başlat':'Hareketi durdur'}</span></button>
      <span class="home-art-label"><span></span>Bir yere dokun, keşfe çık</span></div>
    </section>
    <button class="home-parent-tile" data-do="learning-parent"><span class="home-parent-symbol" aria-hidden="true"><i data-lucide="settings-2"></i></span><span class="home-parent-copy"><small>AKTİF KELİME LİSTEM</small><b>Öğretmenimin kelimeleri</b><span>${listWords.length?`${esc(list?.title||'Kelime listem')} · ${listWords.map(esc).join(', ')}`:'Öğretmenin verdiği kelimelerle kendi listeni oluştur.'}</span></span><span class="home-parent-link">Listeyi düzenle<i data-lucide="arrow-right"></i></span></button>
    <button class="home-parent-tile home-story-route" data-do="learning"><span class="home-parent-symbol" aria-hidden="true">${mapIcon('post')}</span><span class="home-parent-copy"><small>BİRLİKTE BİR HİKÂYE</small><b>${continuing?'Mektup hikâyeme devam et':'Alparslan ve Kayıp Bahçe Mektubu'}</b><span>Öğretmeninin kelimeleriyle birbirine bağlı sekiz görev.</span></span><span class="home-parent-link">Hikâyeyi aç<i data-lucide="arrow-right"></i></span></button>
    ${renderQuestDestinations({assetBase,history:questHistory})}
    <div class="home-section-heading home-explore-heading"><div><span class="home-eyebrow">ADANIN DİĞER KÖŞELERİ</span><h2>Biraz da keşfe çıkalım</h2></div></div>
    <section class="home-explore-grid" aria-label="Adadaki diğer oyunlar"><button class="home-explore-card" data-do="island"><span class="home-explore-picture" aria-hidden="true">🏝️</span><span><b>Adayı keşfet</b><small>Hazır ada oyunları ve öğretmen listene geçiş.</small></span><i data-lucide="arrow-right"></i></button><button class="home-explore-card" data-do="adventure"><span class="home-explore-picture" aria-hidden="true">📖</span><span><b>Kısa hikâyeler</b><small>Hazır kısa hikâyeler · Kendi kelimelerin için macera dünyalarını seç.</small></span><i data-lucide="arrow-right"></i></button></section>
    <section class="home-letter-row" aria-label="Okulda öğrendiğim harfler"><div><small>BİLDİĞİM HARFLER</small><b>Küçük bir harf molası</b></div><div class="mini">${state.letters.slice(0,8).map(letter=>button('letter',esc(letter),`data-letter="${esc(letter)}" aria-label="${esc(letter)} harfini çalış"`,'home-letter-key')).join('')}</div>${button('catalog','Tüm harfler →','data-view="letters"','home-letter-all')}</section>
    <div class="home-bottom-note"><span></span>Acelemiz yok. Her küçük adım bir keşif.</div>
  </div>`;
}
function allowed(text){return [...text.toLocaleLowerCase('tr-TR')].filter(c=>A.includes(c)).every(c=>state.letters.includes(c))}
function tabs(items,value,key){return `<div class="tabs">${items.map(([v,l])=>button('tab',l,`data-key="${key}" data-value="${v}"`,'tab'+(value===v?' on':''))).join('')}</div>`}
function practiceContentPool(domain,source='standard',mode=''){
  const library=teacherLibrary();
  if(domain==='letters')return source==='teacher'?library.letters:[...state.letters];
  if(domain==='numbers')return Array.from({length:(numMode==='trace'?9:numMode==='count'?10:100)+1},(_,number)=>String(number));
  if(domain==='syllables')return (source==='teacher'?library.syllables.map(entry=>entry.text):syllables.filter(allowed)).filter(text=>filter!=='short'||text.length<=3);
  if(domain==='sentences')return (source==='teacher'?library.sentences.map(entry=>entry.text):sentences.filter(allowed)).filter(text=>filter!=='short'||text.split(/\s+/u).length<=2);
  const pool=(source==='teacher'?library.words:words.filter(entry=>allowed(entry.text)&&(mode!=='reading'||entry.read))).filter(entry=>filter!=='short'||entry.text.length<=3);
  return pool.filter(entry=>mode!=='reading'||getTeacherReadingOptions(entry,pool).length>0).map(entry=>entry.text);
}
function practiceDomain(mode){return mode==='reading'?'words':mode}
function practiceButton(mode,source='standard'){return button('practice-next','Bana sıradaki kartı seç →',`data-view="${mode}" data-source="${source}"`,'teacher-library-action')}
function nextPractice(mode,source='standard'){
  if(!modes.some(entry=>entry[0]===mode))return;
  const domain=practiceDomain(mode),pool=practiceContentPool(domain,source,mode);
  const target=orderContentPool(domain,pool,contentStore.getState())[0];
  if(target===undefined){
    modal('Bu kartları birlikte hazırlayalım',`<p>${source==='teacher'?'Aktif öğretmen listesi ve okulda öğrenilen harflerle uygun kart kalmadı.':'Bu seçime ve okulda öğrendiğin harflere uygun standart kart yok.'} ${mode==='reading'?'Okuma eşleştirmesi için en az iki farklı anlam veya resim gerekir.':''}</p><div class="controls">${button('learning-parent','Öğretmenimin listesini düzenle')}${button('settings','Okulda öğrendiğim harfler')}${button('close','Kartlarıma dön','','btn secondary')}</div>`);return;
  }
  view=mode;
  if(mode==='letters')letter(caps?target.toLocaleUpperCase('tr-TR'):target,false,source);
  else if(mode==='numbers')number(Number(target));
  else if(mode==='sentences')sentence(target,source,source==='standard'?String(sentences.indexOf(target)):'');
  else word(target,source);
}
function catalog(){
  const m=modes.find(entry=>entry[0]===view);if(!m){go();return}
  let html='',tab='';
  if(view==='letters'){
    tab=tabs([['lower','Küçük harfler'],['upper','Büyük harfler']],caps?'upper':'lower','caps');
    html=`<div class="grid">${A.map(letter=>{const c=caps?letter.toLocaleUpperCase('tr-TR'):letter;return button('letter',`<b>${c}</b><small>${letter.toLocaleUpperCase('tr-TR')} · ${letter}</small>${state.done.includes('letter:'+c)?'<span class="done">✓</span>':''}`,`data-letter="${c}" data-source="standard"`,'item')}).join('')}</div>`;
  }else if(view==='numbers'){
    tab=tabs([['trace','Rakamları çiz · 0–9'],['count','Say ve bul · 0–10'],['explore','Sayıları keşfet · 0–100']],numMode,'num');
    const end=numMode==='trace'?9:numMode==='count'?10:100;
    html=`<div class="grid numbers">${Array.from({length:end+1},(_,n)=>button('number',`<b>${n}</b>${numMode!=='explore'?'<small>'+numName(n)+'</small>':''}`,`data-number="${n}"`,'item')).join('')}</div>`;
  }else{
    tab=tabs([['all','Hepsi'],['selected','Seçtiğim harfler'],['short','Kısa olanlar']],filter,'filter');
    if(view==='sentences'){
      const list=sentences.map((text,index)=>({text,index})).filter(entry=>filter==='selected'?allowed(entry.text):filter==='short'?entry.text.split(' ').length<=2:true);
      html=`<div class="grid sentences">${list.map(entry=>button('sentence',`<span class="emoji">🌈</span><b>${esc(entry.text)}</b><small>Kartları sırala</small>`,`data-index="${entry.index}" data-text="${esc(entry.text)}" data-source="standard"`,'item')).join('')}</div>`;
      if(!list.length)html='<p>Bu harflerle henüz standart cümle yok. Hepsi seçeneğine dokun.</p>';
    }else{
      let list=view==='syllables'?syllables.map(text=>({text,parts:[text],emoji:'🚂'})):words.filter(entry=>view!=='reading'||entry.read);
      list=list.filter(entry=>filter==='selected'?allowed(entry.text):filter==='short'?entry.text.length<=3:true);
      html=`<div class="grid words">${list.map(entry=>button('word',`<span class="emoji" aria-hidden="true">${entry.emoji}</span><b>${entry.text}</b><small>${entry.parts.join(' · ')}</small>`,`data-text="${entry.text}" data-source="standard"`,'item')).join('')}</div>`;
      if(!list.length)html='<p>Bu seçimle standart kart bulunamadı. Hepsi seçeneğine dokun.</p>';
    }
  }
  const teacher=view!=='numbers'?renderTeacherLibrary(view,teacherLibrary(),{filter,caps}):'';
  if(teacher)html=`<details class="standard-library" data-standard-library="${view}"><summary>Standart alıştırma kütüphanesi</summary><p>Hazır kartlar. Öğretmeninin verdiği harfler, heceler ve kelimeler yukarıdaki bölümde. Otomatik seçim, okulda öğrendiğin harflerle sınırlıdır.</p>${practiceButton(view)}${tab}${html}</details>`;
  $('#main').innerHTML=bar()+`<div class="heading"><h1>${m[1]} ${m[2]}</h1><p>Bir kart seç veya senin için sıradaki kartı hazırlayalım. Tekrarlar bu tarayıcıda hatırlanır.</p></div>`+teacher+(teacher?'':practiceButton(view)+tab)+html;
}
function begin(type,key,text,steps,context={}){
  stop();
  const practiceMode=context.practiceMode||({letter:'letters',digit:'numbers',count:'numbers',number:'numbers',syllable:'syllables',word:'words',reading:'reading',sentence:'sentences'}[type]||'');
  const source=context.source||'standard',domain=practiceDomain(practiceMode);
  const contentPools=context.contentPools||{[domain]:practiceContentPool(domain,source,practiceMode)};
  game={type,key,text,steps,startedAt:performance.now(),playId:crypto.randomUUID(),writingReviewed:false,i:0,ready:false,selected:[],bank:[],trace:null,hint:state.hint,...context,source,practiceMode,contentPools};
  view='lesson';step();window.scrollTo(0,0);
  if(game.adventure)contentStore.expose({id:game.playId,domain:'activities',items:[game.adventure.contentActivity],pool:game.contentPools.activities||[]});
}
function noteLegacyExposure(){
  if(!game)return;
  const task=game.steps[game.i];let domain=practiceDomain(game.practiceMode);
  if(game.adventure)domain=game.adventure.letterOnly||game.i===0?'letters':game.i===1?'syllables':'words';
  const target=task.kind==='count'?String(task.n):String(task.text);
  contentStore.expose({id:`${game.playId}:${game.i}`,domain,items:[target],pool:game.contentPools[domain]||[]});
  const lesson=$('.lesson');if(lesson){lesson.dataset.practiceMode=game.practiceMode;lesson.dataset.contentSource=game.source;lesson.dataset.contentTarget=target;lesson.dataset.contentId=`${game.playId}:${game.i}`}
}
function adventure(){
  const quest=chooseAdventure(state.letters,state.recentAdventure||state.recent,contentStore.getState());
  if(!quest){toast('Bir büyüğünle okulda öğrendiğin harfleri seç.');return}
  begin('adventure',quest.key,quest.steps.at(-1).text,quest.steps,{adventure:quest,contentPools:quest.contentPools});
}
function letter(c,digit=false,source='standard'){if(!P[c])return;if(!digit){state.recent=c.toLocaleLowerCase('tr-TR');save()}begin(digit?'digit':'letter',c,c,[{kind:'match',text:c,digit},{kind:'trace',text:c},{kind:'free',text:c}],{source})}
function buildStep(text,parts,emoji='',sentence=false){return{kind:'build',text,parts,emoji,tokens:sentence?text.trim().split(/\s+/u).filter(Boolean):[...text],sentence}}
function practiceTeacherWord(text){
  const w=teacherLibrary().words.find(entry=>entry.text===text);
  if(!w){toast('Kelime listesini ve okulda öğrendiğin harfleri birlikte kontrol edelim.');return}
  close(false);begin('word',w.text,w.text,[buildStep(w.text,w.parts,esc(w.emoji)),{kind:'free',text:w.text}],{source:'teacher',practiceMode:'words'});
}
function word(text,source='standard'){
  const library=teacherLibrary();
  if(view==='syllables'){
    if(source==='teacher'&&!library.syllables.some(entry=>entry.text===text)){toast('Bu hece aktif kelime listende açık değil.');return}
    begin('syllable',text,text,[buildStep(text,[text],'🚂'),{kind:'free',text}],{source,practiceMode:'syllables'});return;
  }
  const w=(source==='teacher'?library.words:words).find(entry=>entry.text===text);if(!w)return;
  if(view==='reading'){
    const options=getTeacherReadingOptions(w,shuffle(source==='teacher'?library.words:words.filter(entry=>entry.read)));
    if(!options.length){
      modal('Kendi kelimeni keşfet',`<div class="teacher-reading-help"><div class="word">${esc(w.text)}</div><p>Bu kelimeyi harflerden kurup yazabiliriz. Anlam eşleştirmesi için listene en az iki farklı resim ya da kısa anlam eklenmeli.</p><div class="controls">${button('teacher-practice','Kelimemi kur ve yaz',`data-text="${esc(w.text)}"`)}${button('learning-parent','Birlikte anlam ekle')}${button('close','Kartlarıma dön','','btn secondary')}</div></div>`);return;
    }
    begin('reading',text,text,[{kind:'read',word:w,text,options},buildStep(text,w.parts,esc(w.emoji))],{source,practiceMode:'reading'});
  }else begin('word',text,text,[buildStep(text,w.parts,esc(w.emoji)),{kind:'free',text}],{source,practiceMode:'words'});
}
function sentence(text,source='standard',index=''){
  const entry=source==='teacher'?teacherLibrary().sentences.find(item=>item.text===text):sentences.includes(text)?{text}:null;
  if(!entry){toast('Cümleyi ve öğrendiğin harfleri birlikte kontrol edelim.');return}
  begin('sentence',source==='teacher'?teacherSentenceKey(text):index,text,[buildStep(text,[text],'🌈',true),{kind:'free',text}],{source,practiceMode:'sentences'});
}
function number(n){if(numMode==='trace'){letter(String(n),true);return}if(numMode==='count'){begin('count',String(n),String(n),[{kind:'count',n,text:String(n)},...(n<=9?[{kind:'trace',text:String(n)}]:[])]);return}begin('number',String(n),String(n),[{kind:'number',n,text:String(n)},buildStep(String(n),[String(n)]),...[...new Set(String(n))].map(c=>({kind:'trace',text:c})),{kind:'free',text:String(n)}])}
function feedback(t,type=''){if(type==='nudge'){if(state.effects)audio.playEffect('retry');if(game?.observation)game.observation.mistakes++}const e=$('#feedback');if(e){e.textContent=t;e.className='feedback '+type}}
function advance(){
  if(!game||!game.ready)return;
  if(game.i===game.steps.length-1)complete();
  else{game.i++;step();window.scrollTo(0,0)}
}
function ready(t){
  if(!game)return;
  const wasReady=game.ready;
  game.ready=true;$('#next').disabled=false;feedback(t,'success');
  if(wasReady)return;
  observeLegacyStep();
  if(game.i<game.steps.length-1){if(state.effects)audio.playEffect('correct');return}
  const current=game,index=game.i,s=game.steps[index];
  stop();
  showCelebration({
    message:s.successText||t,itemText:s.text,final:index===game.steps.length-1,effects:state.effects,
    onContinue:()=>{if(game===current&&game.i===index&&game.ready)advance()}
  });
}
function pad(c='',free=false){return `<div class="pad"><span class="pad-label">${free?'SENİN YAZI ALANIN':'SARI NOKTADAN BAŞLA'}</span><svg id="pad" viewBox="0 0 400 340" aria-label="${free?'Serbest yazma alanı':esc(c)+' çizme alanı'}" role="img"><path class="guide" d="M15 60H385M15 135H385M15 325H385"/><path class="baseline" d="M15 270H385"/>${(free?[]:P[c]||[]).map((d,i)=>`<path class="outline" data-target="${i}" d="${d}"/><path class="center" d="${d}"/>`).join('')}<g id="ink"></g><g id="markers"></g></svg></div>`}
function step(){releaseWritingGuard();stop();game.ready=false;game.trace=null;game.selected=[];game.bank=[];const s=game.steps[game.i];game.observation={id:crypto.randomUUID(),mistakes:0,hints:s.kind==='free'||s.kind==='build'&&game.hint?1:0};let title='',sub='',body='',speech='';
if(s.kind==='match'||s.kind==='number'){let n=s.kind==='number',pool=s.options|| (n?Array.from({length:101},(_,i)=>String(i)):s.digit?'0123456789'.split(''):s.text===s.text.toLocaleUpperCase('tr-TR')?A.map(x=>x.toLocaleUpperCase('tr-TR')):A);let options=shuffle([s.text,...shuffle(pool.filter(x=>x!==s.text)).slice(0,2)]);title=n?'Bu sayıyı bulalım':'Aynısını bulalım';sub='Yukarıdakinin aynısına dokun.';speech=s.promptSpeech||(n?numName(s.n):'Yukarıdaki işaretin aynısını bul.');body=`<div class="target ${n?'number':''}">${s.text}</div>${n?'<p>'+numName(s.n)+'</p>':''}<div class="options">${options.map(x=>button('match',x,`data-value="${x}"`,'choice')).join('')}</div>`}
else if(s.kind==='trace'){title='“'+s.text+'” yazalım';sub='Sarı noktadan başla, çizginin izini sür.';speech=sub;body=pad(s.text)+`<div class="tools">${button('demo','▶ Nasıl çizilir?','','tool')}${button('clear','🧽 Yeniden çiz','','tool')}</div>`}
else if(s.kind==='free'){title='Şimdi sıra sende';sub='Aşağıya yaz. Bitirince birlikte kontrol edin.';body=`<div class="word" id="freePrompt">${esc(s.text)}</div><div class="controls">${button('hide','Örneği gizle / göster','','')}${button('speak','🔊 Dinle',`data-text="${esc(s.text)}"`,'')}</div>${pad('',true)}<div class="tools">${button('clear','🧽 Temizle','','tool')}${button('review','Yazdım, birlikte bakalım','','tool')}</div><p class="footnote">El yazısı otomatik tanınmaz. Bir büyüğünle kontrol et.</p><div class="controls">${button('paper','Deftere yazdık — birlikte kontrol edelim','','')}</div>`}
else if(s.kind==='build'){title=s.sentence?'Kelimeleri sıraya koyalım':'Parçaları birleştirelim';sub='Kartlara sırayla dokun, boşlukları doldur.';game.bank=shuffle(s.tokens.map((text,id)=>({text,id})));body=`${s.emoji?'<div class="picture">'+s.emoji+'</div>':''}<div class="word" id="buildPrompt">${game.hint?s.parts.map(x=>'<span>'+esc(x)+'</span>').join(''):'?'}</div><div class="controls">${button('hint',game.hint?'İpucunu gizle':'İpucunu göster','','')}${button('speak','🔊 Bütününü dinle',`data-text="${esc(s.promptSpeech||(/^\d+$/.test(s.text)?numName(Number(s.text)):s.text))}"`,'')}</div><div class="${s.sentence?'sent':''}"><div class="slots" id="slots"></div><div class="bank" id="bank"></div></div><div class="controls">${button('undo','Son kartı geri al','','')}${button('restart','Yeniden sırala','','')}</div>`}
else if(s.kind==='read'){game.options=shuffle(s.options||getTeacherReadingOptions(s.word,words.filter(w=>w.read)));const pictured=game.options.every(word=>word.emoji);title=pictured?'Oku ve resmini bul':'Oku ve anlamını bul';sub=pictured?'Bu kelime hangi resmi anlatıyor?':'Kelime hangi resmi ya da anlamı anlatıyor?';body=`<div class="word">${esc(s.text)}</div><div class="controls">${button('speak','🔊 Okurken yardım al',`data-text="${esc(s.text)}"`,'')}</div><div class="options read-options">${game.options.map((w,i)=>button('read',w.emoji?`<span aria-hidden="true">${esc(w.emoji)}</span>`:`<span class="teacher-reading-meaning">${esc(w.meaning)}</span>`,`data-index="${i}" aria-label="${esc(w.emoji?w.text+' resmi':w.meaning)}"`,'choice')).join('')}</div>`}
else if(s.kind==='count'){title='Kaç tane elma var?';sub='Elmalara tek tek dokunarak sayabilirsin.';speech='Elmaları say. Kaç tane var?';let options=shuffle([s.n,...shuffle(Array.from({length:11},(_,i)=>i).filter(x=>x!==s.n)).slice(0,2)]);body=`<div class="basket" aria-label="${s.n} elma">${Array.from({length:s.n},(_,i)=>button('apple','🍎',`aria-label="${i+1}. elma" aria-pressed="false"`,'apple')).join('')||'<span>Sepette hiç elma yok.</span>'}</div><div class="options">${options.map(x=>button('count',String(x),`data-number="${x}"`,'choice')).join('')}</div>`}
if(game.adventure){title=s.title||title;sub=s.sub||sub;speech=s.promptSpeech||speech}
$('#main').innerHTML=`<section class="lesson${game.adventure?' adventure':''}"><div class="bar">${button('home','← Oyunlar','','back')}<span>${esc(game.text)}</span>${button('pause','Mola 🌿','','back')}</div>${game.adventure?`<section class="adventure-story"><div class="adventure-scene" aria-hidden="true">${game.adventure.emoji||'🏝️'}${Array.from({length:3},(_,i)=>`<span class="${i<game.i?'built':''}">${i<game.i?'🌱':'·'}</span>`).join('')}</div><div><span class="teacher-standard-tag">Hazır kısa hikâye</span><h2 id="adventureTitle">${esc(game.adventure.title)}</h2><p>${esc(game.i===0?game.adventure.story:game.steps[game.i-1].successText||game.adventure.story)}</p><div class="adventure-listen">${button('speak','Hikâyeyi dinle',`id="storyListen" data-text="${esc(game.adventure.story)}"`,'tool')}</div></div></section>${renderTeacherRoute(teacherLibrary(),{kind:'words',context:'story'})}`:''}<div class="steps" aria-label="${game.i+1}. adım, toplam ${game.steps.length} adım">${game.steps.map((_,i)=>`<span class="${i<game.i?'past':i===game.i?'now':''}">${i<game.i?'★':'☆'}</span>`).join('')}</div><div class="teacher"><div class="face" aria-hidden="true">🦁</div><div class="bubble"><h1>${esc(title)}</h1><p>${esc(sub)}</p>${speech?button('speak','🔊 Dinle',`data-text="${esc(speech)}"`,''):''}</div></div><div class="exercise">${body}<div class="feedback" id="feedback" role="status" aria-live="polite">Hazır olduğunda başlayabilirsin.</div></div><div class="next-row"><small>${game.i+1} / ${game.steps.length} küçük adım<br>Acelemiz yok.</small>${button('next',game.i===game.steps.length-1?'Tamamla ★':'Devam →','id="next" disabled')}</div><p class="note">🦁 Alparslan: “Adım adım, birlikte.”</p></section>`;
if(s.kind==='trace')trace(s.text,false);if(s.kind==='free')trace('',true);if(s.kind==='build')tiles();noteLegacyExposure();}
function tiles(){const s=game.steps[game.i];$('#slots').innerHTML=s.tokens.map((_,i)=>button('slot',game.selected[i]?esc(game.selected[i].text):'',`data-index="${i}" aria-label="${i+1}. boşluk${game.selected[i]?': '+esc(game.selected[i].text):''}"`,'slot '+(i<game.selected.length?'filled':i===game.selected.length?'active':''))).join('');$('#bank').innerHTML=game.bank.map(t=>button('tile',esc(t.text),`data-id="${t.id}" ${game.selected.some(x=>x.id===t.id)?'disabled':''}`,'tile '+(game.selected.some(x=>x.id===t.id)?'used':''))).join('')}
function tile(id){if(game.ready)return;let t=game.bank.find(x=>x.id===id),s=game.steps[game.i];if(!t||game.selected.some(x=>x.id===id))return;if(t.text!==s.tokens[game.selected.length]){feedback('Bir daha bakalım. Sıradaki parça: '+s.tokens[game.selected.length],'nudge');return}game.selected.push(t);tiles();if(game.selected.length===s.tokens.length)ready('“'+s.text+'” hazır! Hazırsan devam edebilirsin.');else feedback('Güzel, şimdi sıradaki parçayı seç.','success')}
function trace(c,free){const svg=$('#pad'),ns='http://www.w3.org/2000/svg';let active=0,drawing=false,pointerId=null,points=[],path=null,samples=[],hit=new Set(),valid=0,total=0,length=0,last=null,inkLength=0;const targets=Array.from(svg.querySelectorAll('[data-target]'));const all=targets.map(p=>{let len=p.getTotalLength(),n=Math.max(2,Math.ceil(len/4)+1);return{p,len,pts:Array.from({length:n},(_,i)=>p.getPointAtLength(len*i/(n-1)))}});const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);function coord(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=svg.getScreenCTM();return m?p.matrixTransform(m.inverse()):{x:0,y:0}}function markers(){let g=$('#markers');if(!g)return;g.innerHTML='';targets.forEach((p,i)=>{p.classList.toggle('active',i===active);p.classList.toggle('finished',i<active)});if(free||active>=all.length)return;let p=all[active].pts[0];g.innerHTML=`<circle class="start" cx="${p.x}" cy="${p.y}" r="15"/><text class="point-no" x="${p.x}" y="${p.y+1}">${active+1}</text>`}function add(p){if(last){let d=dist(last,p);length+=d;if(free)inkLength+=d}points.push(p);path.setAttribute('d',points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '));if(!free){total++;let best=Infinity,idx=0;samples.forEach((s,i)=>{let d=dist(s,p);if(d<best){best=d;idx=i}});if(best<27){valid++;for(let j=Math.max(0,idx-2);j<=Math.min(samples.length-1,idx+2);j++)if(dist(samples[j],p)<27)hit.add(j)}}last=p}
svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0||!free&&active>=all.length||drawing)return;cancelAnimationFrame(raf);markers();e.preventDefault();let p=coord(e);samples=free?[]:all[active].pts;if(!free&&dist(p,samples[0])>39){feedback('Sarı noktadan başlayalım.','nudge');return}drawing=true;pointerId=e.pointerId;points=[];hit=new Set();valid=0;total=0;length=0;last=null;path=document.createElementNS(ns,'path');path.setAttribute('class','ink');$('#ink').appendChild(path);try{svg.setPointerCapture(e.pointerId)}catch(_){}add(p)});
svg.addEventListener('pointermove',e=>{if(!drawing||e.pointerId!==pointerId)return;e.preventDefault();let p=coord(e),origin=last,n=Math.max(1,Math.ceil(dist(origin,p)/4));for(let i=1;i<=n;i++)add({x:origin.x+(p.x-origin.x)*i/n,y:origin.y+(p.y-origin.y)*i/n})});
function finish(e,cancel=false){if(!drawing||e.pointerId!==pointerId)return;drawing=false;pointerId=null;try{if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId)}catch(_){}if(free){feedback('Bitirdiğinde “Yazdım, birlikte bakalım” düğmesine dokun.');return}let item=all[active],dot=item.len<12;let ok=!cancel&&(dot?dist(last,item.pts[0])<31:hit.size/samples.length>=.81&&valid/Math.max(1,total)>=.7&&dist(last,item.pts.at(-1))<37&&length>=item.len*.62&&length<item.len*2.1+50);if(ok){active++;markers();if(active===all.length)ready('Çizgiyi tamamladın! Hazır olunca devam et.');else feedback('Şimdi '+(active+1)+'. sarı noktadan başlayalım.','success')}else{path.classList.add('retry');let old=path;setTimeout(()=>old.remove(),950);feedback('Sarı noktadan başlayıp çizginin izini yeniden deneyelim.','nudge')}}
svg.addEventListener('pointerup',e=>finish(e));svg.addEventListener('pointercancel',e=>finish(e,true));svg.addEventListener('lostpointercapture',e=>finish(e,true));game.trace={hasInk:()=>inkLength>=12,stopDemo(){markers()},clear(){cancelAnimationFrame(raf);drawing=false;if(pointerId!==null){try{svg.releasePointerCapture(pointerId)}catch(_){}pointerId=null}active=0;inkLength=0;$('#ink').innerHTML='';game.ready=false;$('#next').disabled=true;markers();feedback(free?'Yazı alanın hazır.':'Sarı noktadan başlayabilirsin.')},demo(){if(free||!all.length)return;cancelAnimationFrame(raf);let item=all[Math.min(active,all.length-1)],g=$('#markers');g.innerHTML='';let dot=document.createElementNS(ns,'circle');dot.setAttribute('r','12');dot.setAttribute('fill','#f4bb45');dot.setAttribute('stroke','white');dot.setAttribute('stroke-width','4');g.appendChild(dot);const start=performance.now(),duration=Math.max(1200,item.len*6);feedback('Sarı noktayı izle. Sonra sen deneyebilirsin.');function tick(now){let f=Math.min(1,(now-start)/duration),p=item.p.getPointAtLength(item.len*f);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);if(f<1)raf=requestAnimationFrame(tick);else markers()}raf=requestAnimationFrame(tick)}};markers();mountWritingGuard(svg);}
function complete(){
  releaseWritingGuard();stop();syncCompletion(game);
  const id=game.type+':'+game.key;
  if(!state.done.includes(id))state.done.push(id);
  if(game.adventure)state.recentAdventure=game.adventure.key;
  save();
  const reward=rewards[Math.min(state.done.length-1,rewards.length-1)]||rewards[0];
  const lastStep=game.steps[game.i];
  const focusText=String(game.text).normalize('NFC').toLocaleLowerCase('tr-TR').trim();
  const focusSkill=lastStep.kind==='free'?'write':lastStep.kind==='build'?(game.type==='syllable'?'syllables':'build'):lastStep.kind==='read'?'meaning':'';
  const learner=learningStore.getState(),list=learner.lists.find(item=>item.id===learner.activeListId)||learner.lists[0];
  const nextTask=focusSkill?planSession(learner,state.letters,Date.now(),{limit:8,focusText,focusSkill,selection:contentStore.getState()}).tasks[0]:null;
  const focusTokens=focusText.split(/[^abcçdefgğhıijklmnoöprsştuüvyz]+/u).filter(Boolean);
  const nextEntry=list?.words.find(word=>word.text===nextTask?.word);
  const related=nextEntry&&focusTokens.some(token=>nextEntry.text===token||nextEntry.parts.includes(token)||(token.length===1&&nextEntry.text.includes(token)));
  const nextLabels={listen:'Dinleyip bulalım',syllables:'Hecelerden kuralım',build:'Harflerle kuralım',recall:'Örneksiz hatırlayalım',write:'Kendimiz yazalım',meaning:'Anlamını bulalım',sentence:'Cümlede kullanalım'};
  const contextPreview=related?`<div class="continuation-preview info"><strong>Sıradaki adım: ${esc(nextLabels[nextTask.kind]||'Birlikte keşfedelim')}</strong><p>${esc(nextTask.reason)}</p></div>`:'';
  const continueButton=related?button('learning-continue',`“${esc(nextTask.word)}” ile devam et →`,`data-focus-text="${esc(focusText)}" data-focus-skill="${focusSkill}"`):button('learning','Öğrenme yolculuğuma devam et →');
  $('#main').innerHTML=bar()+`<section class="party"><div class="reward">${reward[0]}</div><h1>${game.adventure?'Macerayı tamamladın!':'Tebrikler, başardın!'}</h1><p class="celebration-note">${esc(game.adventure?.ending||'Emek verdin, tamamladın!')}</p><div class="word">${esc(game.text)}</div><p>“${reward[1]}” çıkartması senin.<br>Şimdi mola verebilir ya da yeni bir oyun seçebilirsin.</p>${contextPreview}<div class="actions">${continueButton}${button('home','Oyun bahçesi','','btn secondary')}${button('adventure','Yeni macera','','btn secondary')}${game.practiceMode?practiceButton(game.practiceMode,game.source):''}${button('repeat','Bir daha dene','','btn secondary')}${button('stickers','Çıkartmalarım','','btn secondary')}</div></section>${game.adventure?`<section class="island-continuation"><h2>Hikâye burada bitmesin!</h2><p>Kartın hazır. Şimdi adada bir iş başaralım. Hangi oyuna gidelim?</p><div class="island-continuation-games">${button('island-zone','<span>🐈</span><b>Hayvan dostları</b><small>Paketi bul, dostunu besle</small>','data-zone="care"','')}${button('island-zone','<span>🚂</span><b>Hece treni</b><small>Vagonları yap, teslimata çık</small>','data-zone="train"','')}${button('island-zone','<span>🏝️</span><b>Hazine yolu</b><small>Yolu bul, sandığı aç</small>','data-zone="treasure"','')}</div></section>`:''}`;
  window.scrollTo(0,0);
}
function stickerPage(){$('#main').innerHTML=bar()+`<div class="heading"><h1>⭐ Çıkartma hazinen</h1><p>Her yeni alıştırma bir keşif. ${state.done.length} farklı alıştırmayı tamamladın.</p></div><div class="stickers">${rewards.map(([emoji,title],i)=>`<div class="sticker ${i>=state.done.length?'locked':''}"><span>${emoji}</span><h3>${title}</h3><small>${i<state.done.length?'Senin oldu!':(i+1)+'. keşifte'}</small></div>`).join('')}</div>`}
function modal(title,body){stop();const d=$('#dialog');d.innerHTML=`<div class="dialog-head"><h2 id="dialogTitle">${title}</h2>${button('close','','aria-label="Kapat"','close')}</div>`+body;if(!d.open)d.showModal()}
let refreshOnDialogClose=true;
function close(refresh=true){let d=$('#dialog');if(d.open){refreshOnDialogClose=refresh;d.close()}}
$('#dialog').addEventListener('close',()=>{const refresh=refreshOnDialogClose;refreshOnDialogClose=true;if(!refresh)return;if(view==='home')home();else if(view==='island'){island.renderMap();showIslandTeacherRoute()}else if(view==='learning'||view==='learning-parent')learning.resume?.();else if(modes.some(m=>m[0]===view))catalog();game?.trace?.stopDemo?.()});
function settings(){modal('Birlikte öğrenelim',`${renderProfileControls()}<div class="controls">${button('learning-parent','Öğretmenimin kelimeleri ve gelişim','','tool')}</div><h3>Okulda öğrendiğimiz harfler</h3><p>Öğretmeninizin işlediği harfleri seçin. Kısa maceralar yalnızca bu harflerle hazırlanır. Serbest oyunlardan diğer harflere de ulaşabilirsiniz.</p><div class="settings">${A.map(l=>button('select-letter',l,`data-letter="${l}" aria-pressed="${state.letters.includes(l)}"`,state.letters.includes(l)?'selected':'')).join('')}</div><div class="controls">${button('all-letters','Tümünü seç','','')}${button('first-letters','İlk harfler: a n e t i l','','')}</div><label class="setting">İpucu başlangıçta görünsün<input id="hint-setting" type="checkbox" ${state.hint?'checked':''}></label><label class="setting">Ses açık<input id="sound-setting" type="checkbox" ${!state.muted?'checked':''}></label><label class="setting">Kısa oyun sesleri<input id="effects-setting" type="checkbox" ${state.effects?'checked':''}></label><div class="controls" aria-label="Oyun seslerini dene">${button('effect-preview','Dokunuş','data-effect="tap"','tool')}${button('effect-preview','Doğru cevap','data-effect="correct"','tool')}${button('effect-preview','Macera sonu','data-effect="complete"','tool')}</div><label class="setting">Ses düzeyi<input id="voice-volume" type="range" min="0" max="1" step="0.05" value="${state.volume}" aria-label="Ses düzeyi"></label><p class="info">İlerleme bu tarayıcıda saklanır. Bu oyun el yazısını, çocuğun zekâsını veya bir öğrenme güçlüğünü değerlendirmez. Harflerin cihaz sesi, öğretmenin verdiği ses çalışmasının yerine geçmez.</p>${button('reset','İlerlemeyi sıfırla','','danger')}`)}
function review(paper=false){if(!game)return;if(!paper&&!game.trace?.hasInk()){feedback('Önce yazı alanına yazmayı dene.','nudge');return}modal('Birlikte kontrol edelim',`<p>Yazdığın <strong>${esc(game.steps[game.i].text)}</strong> örneğe benziyor mu? Bir büyüğünle birlikte bak.</p><div class="actions">${button('approve','Birlikte kontrol ettik ✓')}${button('close','Bir daha deneyeceğim','','btn secondary')}</div>`)}
document.addEventListener('change',e=>{if(e.target.id==='effects-setting'){state.effects=e.target.checked;save()}if(e.target.id==='voice-volume'){state.volume=Number(e.target.value);save()}if(e.target.id==='hint-setting'){state.hint=e.target.checked;save()}if(e.target.id==='sound-setting'){state.muted=!e.target.checked;save();if(state.muted){audio.stopSpeech();hideCelebration()}}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b||b.disabled)return;if(state.effects&&b.dataset.do!=='effect-preview')audio.playEffect('tap');let a=b.dataset.do,s=game?.steps[game.i];if(a==='home-motion')toggleHomeMotion(b);else if(a==='learning-world'){const entryKinds={post:'listen',workshop:'build',bridge:'recall',garden:'meaning'};if(Object.hasOwn(entryKinds,b.dataset.world))openLearningContext({entryKind:entryKinds[b.dataset.world]})}else if(a==='learning-continue')openLearningContext({focusText:b.dataset.focusText||'',focusSkill:b.dataset.focusSkill||''});else if(a==='learning'){go('learning');learning.start()}else if(a==='learning-parent')go('learning-parent');else if(a==='home')go();else if(a==='quest-start')openQuest(b.dataset.questKind);else if(a==='catalog')go(b.dataset.view);else if(a==='stickers')go('stickers');else if(a==='island')openIsland();else if(a==='island-zone')openIsland(b.dataset.zone);else if(a==='adventure')adventure();else if(a==='letter')letter(b.dataset.letter,false,b.dataset.source||'standard');else if(a==='practice-next')nextPractice(b.dataset.view,b.dataset.source||'standard');else if(a==='word')word(b.dataset.text,b.dataset.source||'standard');else if(a==='teacher-practice')practiceTeacherWord(b.dataset.text);else if(a==='sentence')sentence(b.dataset.text||sentences[Number(b.dataset.index)],b.dataset.source||'standard',b.dataset.index);else if(a==='number')number(Number(b.dataset.number));else if(a==='tab'){if(b.dataset.key==='caps')caps=b.dataset.value==='upper';else if(b.dataset.key==='num')numMode=b.dataset.value;else filter=b.dataset.value;catalog()}
else if(a==='sound'){state.muted=!state.muted;save();if(state.muted){audio.stopSpeech();hideCelebration()}else speak('Merhaba! Birlikte oynayalım.')}else if(a==='effect-preview'){if(state.muted||!state.effects)toast('Dinlemek için sesi ve kısa oyun seslerini açabilirsin.');else audio.playEffect(b.dataset.effect)}else if(a==='speak'){if(game?.steps[game.i]?.kind==='read'&&game.observation)game.observation.hints++;speak(b.dataset.text)}else if(a==='settings')settings();else if(a==='close')close();else if(a==='select-letter'){let l=b.dataset.letter;if(state.letters.includes(l)){if(state.letters.length===1){toast('En az bir harf seçili kalsın.');return}state.letters=state.letters.filter(x=>x!==l)}else state.letters.push(l);save();b.classList.toggle('selected',state.letters.includes(l));b.setAttribute('aria-pressed',String(state.letters.includes(l)))}else if(a==='all-letters'||a==='first-letters'){state.letters=a==='all-letters'?[...A]:['a','n','e','t','i','l'];save();settings()}
else if(a==='reset')modal('İlerleme silinsin mi?',`<p>Tamamlanan alıştırmalar, çıkartmalar ve öğrenme gözlemleri silinecek. Öğretmen kelime listeleri korunacak. Bu işlem geri alınamaz.</p><div class="actions">${button('confirm-reset','Evet, sıfırla')}${button('close','Vazgeç','','btn secondary')}</div>`);else if(a==='confirm-reset')resetProgress()
else if(a==='pause')modal('Küçük bir mola 🌿',`<p>Kalemini bırak. Ellerini dinlendir. Hazır olunca kaldığın yerden devam et.</p><div class="actions">${button('close','Oyuna dön')}${button('home','Oyun bahçesi','','btn secondary')}</div>`);
else if(a==='notes')modal('Kendi hızında',`<p>Kısa bir oyun seçin. Önce gösterin, sonra birlikte deneyin. Çocuk bitirmeden sonraki adıma geçmeyin. Yanlışta acele ettirmeden ipucuna dönün; yorulunca mola verin.</p><p>Çizim oyunu yalnızca kılavuzun izlenmesini kontrol eder. Serbest yazıyı birlikte değerlendirin. Hazır Türkçe kayıt bulunmayan metinlerde cihazın Türkçe sesi kullanılır. İnternet bağlantısı sayfanın ilk açılışı için gereklidir.</p><p>Oyun sesleri: Pixabay üzerinden miraclei ve Universfield. <a href="audio/LICENSE-pixabay-v4.txt" target="_blank" rel="noopener">Kaynak ve lisans</a>.</p>`);
else if(a==='match'&&game&&!game.ready){if(b.dataset.value===s.text){b.classList.add('ok');$$('.choice').forEach(x=>x.disabled=true);ready('Aynısını buldun! Hazırsan devam edebilirsin.')}else feedback('Bir daha bakalım. Yukarıdaki işarete dikkat et.','nudge')}
else if(a==='read'&&game&&!game.ready){let w=game.options[Number(b.dataset.index)];if(w.text===s.text){b.classList.add('ok');$$('.choice').forEach(x=>x.disabled=true);ready(w.emoji?'Kelime ve resim eşleşti!':'Kelime ve anlamı eşleşti!')}else feedback('Kelimeye yeniden bakalım. Okurken yardım alabilirsin.','nudge')}
else if(a==='count'&&game&&!game.ready){if(Number(b.dataset.number)===s.n){b.classList.add('ok');$$('.choice').forEach(x=>x.disabled=true);ready('Saydın ve buldun!')}else feedback('Elmaları bir daha, tek tek sayalım.','nudge')}
else if(a==='apple'){let yes=b.classList.toggle('counted');b.setAttribute('aria-pressed',String(yes))}
else if(a==='tile'&&game)tile(Number(b.dataset.id));else if((a==='undo'||a==='slot')&&game&&s.kind==='build'){const index=a==='slot'?Number(b.dataset.index):game.selected.length-1;if(index<0||index>=game.selected.length)return;game.selected.splice(index);game.ready=false;$('#next').disabled=true;tiles();feedback('Sıradaki parçayı seçebilirsin.')}
else if(a==='restart'&&game&&s.kind==='build'){game.selected=[];game.bank=shuffle(game.bank);game.ready=false;$('#next').disabled=true;tiles();feedback('İlk parçayı seçebilirsin.')}
else if(a==='hint'&&game){game.hint=!game.hint;if(game.hint&&game.observation)game.observation.hints++;$('#buildPrompt').innerHTML=game.hint?s.parts.map(x=>'<span>'+esc(x)+'</span>').join(''):'?';b.textContent=game.hint?'İpucunu gizle':'İpucunu göster'}
else if(a==='hide'&&game){let p=$('#freePrompt');p.textContent=p.textContent==='?'?s.text:'?'}else if(a==='clear'&&game)game.trace?.clear();else if(a==='demo'&&game)game.trace?.demo();else if(a==='review')review();else if(a==='paper')review(true);else if(a==='approve'&&game){game.writingReviewed=true;close();ready('Birlikte kontrol ettiniz. Hazırsan devam edebilirsin.')}
else if(a==='next'){advance()}else if(a==='repeat'&&game){const previous=game;begin(previous.type,previous.key,previous.text,previous.steps,{adventure:previous.adventure,contentPools:previous.contentPools,source:previous.source,practiceMode:previous.practiceMode})}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(view==='quest'){const kind=questHistory.active?.kind;if(kind)quests.start(kind);else go()}else if(view==='island'){island.renderMap();showIslandTeacherRoute()}else if(view==='learning'||view==='learning-parent')learning.resume?.()});$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){let r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
render();refreshIcons();void learningStore.initialize();window.addEventListener('online',()=>{void learningStore.flush()});window.addEventListener('pagehide',()=>{void learningStore.flush()});const initialProgressEpoch=progressEpoch;loadServerProgress().then(progress=>{if(initialProgressEpoch!==progressEpoch||!Array.isArray(progress?.completed_items))return;const restored=progress.completed_items.map(x=>x.item_key).filter(x=>typeof x==='string'&&/^(letter|digit|count|number|syllable|word|sentence|reading|adventure|island):/.test(x));const changed=item=>freshProgress.has(normalizeIslandCompletion(item)||item);const recent=state.done.filter(changed);state.done=mergeCompletions([...state.done.filter(item=>!changed(item)),...restored.filter(item=>!changed(item)),...recent]);freshProgress.clear();save();if(view==='home')home();else if(view==='island'&&$('#island')?.dataset.islandScene==='map'){island.renderMap();showIslandTeacherRoute()}else if(view==='stickers')stickerPage()});$('#ready').textContent='🟢 Oyun hazır';window.HARF_ADASI_READY=true;
}catch(e){report(e)}})();
