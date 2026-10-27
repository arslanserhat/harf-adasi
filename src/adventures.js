import { orderContentPool } from './content-selection.js';

const ALPHABET = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
const BUILD_PROMPT = 'Kartlara sırayla dokun, boşlukları doldur.';

// These are short, parent-readable stories. Their activity targets are always
// limited to the selected letters; a story never unlocks another letter.
const STORIES = [
  {
    key: 'nane-bahcesi', title: 'Nane bahçesi', focus: 'n', syllable: 'na',
    word: 'nane', parts: ['na', 'ne'], emoji: '🌿',
    story: 'Alparslan bahçedeki saksı için bir nane etiketi arıyor. Harfi bul, heceyi yap, etiketi tamamla.',
    goal: 'Saksı için nane etiketini hazırla.',
    success: ['n harfini buldun! Nane etiketinin ilk kartı hazır.', 'na hecesi hazır! Saksının etiketine bir adım daha yaklaştık.', 'nane etiketi tamam! Saksının isim kartını hazırladın.'],
    ending: 'Alparslan nane saksısının etiketini buldu. Bahçedeki bu küçük görev tamam!',
  },
  {
    key: 'lalenin-karti', title: 'Lalenin kartı', focus: 'l', syllable: 'la',
    word: 'lale', parts: ['la', 'le'], emoji: '🌷',
    story: 'Bahçedeki lalenin isim kartı eksik. Alparslan ile harfleri ve heceleri birleştirip kartı hazırlayalım.',
    goal: 'Çiçek için lale kartını tamamla.',
    success: ['l harfini buldun! Çiçeğin kartına başlayabiliriz.', 'la hecesi hazır! Lalenin kartının ilk parçasını yaptın.', 'lale kartı tamam! Çiçeğin artık bir isim kartı var.'],
    ending: 'Lalenin isim kartını hazırladın. Alparslan çiçeğini artık bu kartla tanıtabilir!',
  },
  {
    key: 'anneye-kart', title: 'Anneye bir kart', focus: 'a', syllable: 'an',
    word: 'anne', parts: ['an', 'ne'], emoji: '👩',
    story: 'Alparslan annesine küçük bir kart hazırlıyor. Kartın üstüne anne yazmak için üç küçük görevimiz var.',
    goal: 'Heceleri birleştir, anne kartını hazırla.',
    success: ['a harfini buldun! Anneye hazırladığımız kart başladı.', 'an hecesi hazır! Kartın ilk parçasını tamamladın.', 'anne yazan kart hazır! Küçük sürprizi tamamladın.'],
    ending: 'Alparslan annesine vereceği kartı hazırladı. Bu sürprizi birlikte yaptınız!',
  },
  {
    key: 'nineye-surpriz', title: 'Nineye küçük sürpriz', focus: 'n', syllable: 'ni',
    word: 'nine', parts: ['ni', 'ne'], emoji: '👵',
    story: 'Alparslan ninesine bir resim götürecek. Resmin isim kartını harf ve hece kartlarıyla birlikte hazırlayalım.',
    goal: 'Sürpriz resim için nine kartını tamamla.',
    success: ['n harfini buldun! Ninenin sürpriz kartına başlayalım.', 'ni hecesi hazır! Sürpriz kartının ilk parçasını buldun.', 'nine kartı tamam! Resmin isim kartı hazır.'],
    ending: 'Nineye götürülecek resmin kartını tamamladın. Alparslan sürprizini hazırladı!',
  },
  {
    key: 'meyve-sepeti', title: 'Meyve sepeti', focus: 'e', syllable: 'el',
    word: 'elma', parts: ['el', 'ma'], emoji: '🍎',
    story: 'Alparslan meyve sepetine bir elma etiketi hazırlıyor. Önce harfi bulalım, sonra kartları birleştirelim.',
    goal: 'Meyve sepeti için elma etiketini hazırla.',
    success: ['e harfini buldun! Meyve sepetinin etiketine başlayalım.', 'el hecesi hazır! Elma etiketinin ilk parçasını yaptın.', 'elma etiketi tamam! Meyve sepetinin kartı hazır.'],
    ending: 'Meyve sepetinin elma etiketini hazırladın. Alparslan bu görevde seninle birlikte başardı!',
  },
  {
    key: 'kedinin-mamasi', title: 'Kedinin mama kabı', focus: 'm', syllable: 'ma',
    word: 'mama', parts: ['ma', 'ma'], emoji: '🐈', speech: BUILD_PROMPT,
    story: 'Kedinin mama kabına bir etiket gerekiyor. Alparslan ile iki ma hecesini yan yana getirelim.',
    goal: 'İki ma kartından mama etiketini yap.',
    success: ['m harfini buldun! Kedinin mama kartına başlayalım.', 'ma hecesi hazır! Aynı heceden bir tane daha kullanacağız.', 'ma ve ma birleşti, mama oldu! Kedinin etiketi hazır.'],
    ending: 'Kedinin mama kabının etiketini yaptın. İki aynı heceden bir sözcük kurdun!',
  },
  {
    key: 'ciftlikte-at', title: 'Çiftlikteki arkadaş', focus: 'a', syllable: 'at',
    word: 'at', parts: ['at'], emoji: '🐎',
    story: 'Alparslan çiftlikteki atın resmine bir isim kartı koyacak. Harfi bulup at kartını hazırlayalım.',
    goal: 'Atın resmine at kartını hazırla.',
    success: ['a harfini buldun! Atın isim kartına başlayalım.', 'a ve t birleşti, at oldu! Resmin sözcüğünü yaptın.', 'at kartını buldun! Çiftlikteki arkadaşın isim kartı hazır.'],
    ending: 'Çiftlikteki atın isim kartını hazırladın. Alparslan ile üç küçük görevi tamamladın!',
  },
  {
    key: 'yardim-eli', title: 'Yardım eli', focus: 'e', syllable: 'el',
    word: 'el', parts: ['el'], emoji: '✋',
    story: 'Alparslan el resmini tamamladı. Resmin altına el yazan kartı birlikte yerleştirelim.',
    goal: 'El resmi için el kartını hazırla.',
    success: ['e harfini buldun! El resminin kartına başlayalım.', 'e ve l birleşti, el oldu! Resmin sözcüğünü yaptın.', 'el kartını buldun! Resmin isim kartı tamam.'],
    ending: 'El resminin isim kartını hazırladın. Alparslan ile bu küçük görevi tamamladın!',
  },
  {
    key: 'arinin-karti', title: 'Arının isim kartı', focus: 'ı', syllable: 'ar',
    word: 'arı', parts: ['a', 'rı'], emoji: '🐝',
    story: 'Bahçedeki arının isim kartı kaybolmuş. Alparslan ile yeni kartın harflerini ve hecelerini bulalım.',
    goal: 'Arının resmi için arı kartını tamamla.',
    success: ['ı harfini buldun! Arının kartına başlayalım.', 'ar hecesi hazır! Arının kartı için harfleri birleştirdin.', 'a ve rı birleşti, arı oldu! İsim kartını tamamladın.'],
    ending: 'Arının yeni isim kartını hazırladın. Alparslan ile bahçedeki görevi tamamladın!',
  },
];

function normalizeLetter(value) {
  if (typeof value !== 'string') return '';
  const letter = value.normalize('NFC').toLocaleLowerCase('tr-TR').trim();
  return ALPHABET.includes(letter) ? letter : '';
}

export function getAdventureActivityKey(key) {
  if (STORIES.some(story => story.key === key)) return `adventure:${key}`;
  if (typeof key !== 'string' || !key.startsWith('harf-kesfi-')) return '';
  const letters = [...key.slice('harf-kesfi-'.length)];
  return letters.length && letters.every(letter => ALPHABET.includes(letter))
    ? `adventure:letters-${letters.map(letter => letter.codePointAt(0).toString(36)).join('-')}` : '';
}

function matchStep(letter, known) {
  return {
    kind: 'match', text: letter, digit: false,
    // The renderer must use this pool rather than the entire alphabet.
    options: [...known], promptSpeech: `${letter} harfini bul.`,
  };
}

function buildStep(text, tokens, emoji = '', promptSpeech = text) {
  return {
    kind: 'build', text, tokens: [...tokens], parts: [...tokens],
    emoji, sentence: false, promptSpeech,
  };
}

/**
 * Choose a reproducible three-step adventure using only known Turkish letters.
 * recent may be the last studied letter or the previously completed story key.
 * An empty/invalid selection returns null so a caller can request a selection
 * instead of silently introducing a letter the child has not studied.
 */
export function chooseAdventure(letters, recent = '', selection) {
  const input = Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : [];
  const selected = new Set(input.map(normalizeLetter).filter(Boolean));
  const known = ALPHABET.filter(letter => selected.has(letter));
  if (!known.length) return null;
  const last = normalizeLetter(recent);
  const previousKey = typeof recent === 'string' ? recent.trim() : '';
  const eligible = STORIES.filter(story => [...story.word].every(letter => selected.has(letter)));

  if (eligible.length) {
    // A completed story advances through the entire eligible list and wraps.
    // Only the first choice uses the recent letter to prefer another focus.
    const previousIndex = eligible.findIndex(story => story.key === previousKey);
    const different = eligible.filter(story => story.focus !== last);
    const choices = different.length ? different : eligible;
    const seed = [...known.join('') + (last || previousKey)].reduce((sum, letter) => sum + letter.codePointAt(0), 0);
    const activityPool = eligible.map(story => getAdventureActivityKey(story.key));
    const nextActivity = selection === undefined ? '' : orderContentPool('activities', activityPool, selection)[0];
    const story = nextActivity ? eligible.find(story => getAdventureActivityKey(story.key) === nextActivity) : previousIndex >= 0
      ? eligible[(previousIndex + 1) % eligible.length]
      : choices[seed % choices.length];
    const steps = [
      matchStep(story.focus, known),
      buildStep(story.syllable, [...story.syllable], '', story.syllable),
      // Keep duplicate syllables as separate cards: ma + ma is not ma.
      buildStep(story.word, story.parts, story.emoji, story.speech || story.word),
    ];
    const titles = ['Harf kartını bulalım', 'Harflerden hece yapalım', 'İsim kartını tamamlayalım'];
    const subtitles = ['Yukarıdaki harfin aynısını seç.', 'Harf kartlarına sırayla dokun.', story.parts.length > 1 ? 'Hece kartlarını sırayla birleştir.' : 'Sözcük kartını seç.'];
    return {
      key: story.key, title: story.title, story: story.story, goal: story.goal,
      ending: story.ending, emoji: story.emoji,
      contentActivity: getAdventureActivityKey(story.key),
      contentPools: { activities: activityPool, letters: known,
        syllables: [...new Set(eligible.map(entry => entry.syllable))], words: [...new Set(eligible.map(entry => entry.word))] },
      steps: steps.map((step, index) => ({ ...step, title: titles[index], sub: subtitles[index], successText: story.success[index] })),
    };
  }

  const first = selection === undefined ? known.find(letter => letter !== last) || known[0]
    : orderContentPool('letters', known, selection)[0];
  const second = known.find(letter => letter !== first) || first;
  return {
    key: `harf-kesfi-${known.join('')}`, title: 'Üç küçük harf görevi',
    story: 'Alparslan üç küçük kart hazırlıyor. Bildiğin harfleri bulup kendi kartını tamamlayalım.',
    goal: 'Seçtiğin harflerle üç kart görevini tamamla.',
    ending: 'Alparslan ile bildiğin harflerden üç küçük kart hazırladın!', emoji: '⭐',
    letterOnly: true, contentActivity: getAdventureActivityKey(`harf-kesfi-${known.join('')}`),
    contentPools: { activities: [getAdventureActivityKey(`harf-kesfi-${known.join('')}`)], letters: known, syllables: [], words: [] },
    steps: [matchStep(first, known), buildStep(first, [first]), matchStep(second, known)].map((step, index) => ({
      ...step, successText: ['İlk harf kartını buldun! İki küçük görevimiz kaldı.', 'Harf kartını yaptın! Son kartı da birlikte bulalım.', 'Son harf kartı da hazır! Üç küçük görevi tamamladın.'][index],
    })),
  };
}
