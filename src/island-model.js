const ALPHABET = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
const PLACEMENTS = ['beach', 'garden', 'station'];

export const ISLAND_COMPANIONS = Object.freeze({
  cat: Object.freeze({ emoji: '🐈', name: 'Minik Kedi' }),
  dog: Object.freeze({ emoji: '🐕', name: 'Neşeli Köpek' }),
  bird: Object.freeze({ emoji: '🐦', name: 'Minik Kuş' }),
});

export const ISLAND_ZONES = Object.freeze([
  Object.freeze({ id: 'care', title: 'Dostlar Koyu', emoji: '🐢', description: 'Paketleri bul, dostlarını besle ve koyunu canlandır.' }),
  Object.freeze({ id: 'train', title: 'Harf Ekspresi', emoji: '🚂', description: 'Vagonları birleştir, treni gönder ve yeni duraklar kur.' }),
  Object.freeze({ id: 'treasure', title: 'Keşif Sahili', emoji: '🏝️', description: 'Sesli taşlardan ilerle, şifreyi kur ve hazineni adaya yerleştir.' }),
]);

// Targets and wagon/code tokens have local Turkish recordings. Introductions
// are parent-readable scene descriptions, not mandatory synthesized narration.
const AUTHORED = [
  {
    key: 'care-a', zone: 'care', title: 'Dostunun ilk paketi', target: 'a', tokens: ['a'],
    options: ['a', 'e', 'n'], emoji: '🐕',
    intro: 'Minik dostun paketini bekliyor. a yazan paketi bul, sonra önündeki kaba bırak.',
    success: 'Paket dostuna ulaştı! Oyunsever dostun artık koyunda.',
    reward: { emoji: '🐕', label: 'Oyunsever köpek' },
  },
  {
    key: 'care-e', zone: 'care', title: 'Dostunun mama paketi', target: 'e', tokens: ['e'],
    options: ['e', 'a', 'i'], emoji: '🐈',
    intro: 'Dostun mama kabının yanında bekliyor. e yazan paketi dinleyerek bul ve kabına koy.',
    success: 'Dostun mamasına kavuştu! Küçük dostun koyuna yerleşti.',
    reward: { emoji: '🐈', label: 'Mırmır kedi' },
  },
  {
    key: 'care-nane', zone: 'care', title: 'Bahçeden gelen paket', target: 'nane', tokens: ['na', 'ne'],
    options: ['nane', 'anne', 'lale'], emoji: '🐢',
    intro: 'Dostun bahçede dinleniyor. Üstünde nane yazan paketi bul ve dostunun kabına bırak.',
    success: 'Bahçeden gelen paket dostuna ulaştı! Küçük dostun koyunda seni bekliyor.',
    reward: { emoji: '🐢', label: 'Bahçıvan kaplumbağa' },
  },
  {
    key: 'care-et', zone: 'care', title: 'Dostunun yiyecek paketi', target: 'et', tokens: ['e', 't'],
    options: ['et', 'el', 'at'], emoji: '🦊',
    intro: 'Minik dostun kabını getirdi. Üstünde et yazan paketi dinleyerek seç ve kabına bırak.',
    success: 'Dostun yiyeceğini aldı! Yeni dostun koyuna katıldı.',
    reward: { emoji: '🦊', label: 'Minik tilki' },
  },
  {
    key: 'care-su', zone: 'care', title: 'Dostunun su kabı', target: 'su', tokens: ['s', 'u'],
    options: ['su', 'süt', 'muz'], emoji: '🐦',
    intro: 'Dostun kabının yanında bekliyor. su yazan paketi bul ve kabına götür.',
    success: 'Dostunun kabı doldu! Neşeli dostun koyuna yerleşti.',
    reward: { emoji: '🐦', label: 'Neşeli kuş' },
  },
  {
    key: 'care-elma', zone: 'care', title: 'Dostunun elma sepeti', target: 'elma', tokens: ['el', 'ma'],
    options: ['elma', 'lale', 'anne'], emoji: '🐎',
    intro: 'Dostun sepetinin yanında bekliyor. elma yazan paketi dinleyerek bul ve önündeki kaba koy.',
    success: 'Paket dostunun kabına ulaştı! Yeni dostun koyundaki yerini aldı.',
    reward: { emoji: '🐎', label: 'Elma seven at' },
  },
  {
    key: 'train-anne', zone: 'train', title: 'Anneye giden tren', target: 'anne', tokens: ['a', 'n', 'n', 'e'],
    options: ['anne', 'nane', 'nine'], emoji: '🚂',
    intro: 'Alparslan annesine kart gönderecek. a, n, n, e vagonlarını birleştir ve treni istasyona gönder.',
    success: 'Tren anne kartını istasyona ulaştırdı! İlk durağın hazır.',
    reward: { emoji: '🏠', label: 'Aile durağı' },
  },
  {
    key: 'train-nane', zone: 'train', title: 'Bahçeye hece treni', target: 'nane', tokens: ['na', 'ne'],
    options: ['nane', 'anne', 'nine'], emoji: '🚂',
    intro: 'Bahçeye nane kartı götürüyoruz. na ve ne vagonlarını birleştir, sonra treni yola çıkar.',
    success: 'Nane treni bahçe durağına ulaştı! Bahçenin yolu açıldı.',
    reward: { emoji: '🌿', label: 'Nane bahçesi durağı' },
  },
  {
    key: 'train-lale', zone: 'train', title: 'Çiçek durağına yolculuk', target: 'lale', tokens: ['la', 'le'],
    options: ['lale', 'nane', 'elma'], emoji: '🚂',
    intro: 'Çiçek durağında bir lale kartı bekleniyor. la ve le vagonlarını bağlayıp treni gönder.',
    success: 'Lale kartı çiçek durağına geldi! Yoluna renkli bir durak eklendi.',
    reward: { emoji: '🌷', label: 'Çiçek durağı' },
  },
  {
    key: 'train-at', zone: 'train', title: 'Çiftlik treni', target: 'at', tokens: ['a', 't'],
    options: ['at', 'et', 'an'], emoji: '🚂',
    intro: 'Çiftliğe at kartı taşıyoruz. a ve t vagonlarını sıraya koy ve çiftlik istasyonuna gönder.',
    success: 'Tren çiftliğe ulaştı! Atın istasyonu dünyana eklendi.',
    reward: { emoji: '🐎', label: 'Çiftlik istasyonu' },
  },
  {
    key: 'train-el', zone: 'train', title: 'Resim atölyesine tren', target: 'el', tokens: ['e', 'l'],
    options: ['el', 'al', 'et'], emoji: '🚂',
    intro: 'Resim atölyesi el kartını bekliyor. e ve l vagonlarını bağla, sonra treni atölyeye gönder.',
    success: 'El kartı atölyeye ulaştı! Yeni resim durağın hazır.',
    reward: { emoji: '🎨', label: 'Resim atölyesi durağı' },
  },
  {
    key: 'train-saat', zone: 'train', title: 'Saat kulesine yolculuk', target: 'saat', tokens: ['sa', 'at'],
    options: ['saat', 'at', 'sa'], emoji: '🚂',
    intro: 'Saat kulesi kendi kartını bekliyor. sa ve at vagonlarını birleştir, treni kuleye gönder.',
    success: 'Saat kartı kuleye ulaştı! İstasyonuna bir saat kulesi eklendi.',
    reward: { emoji: '⏰', label: 'Saat kulesi istasyonu' },
  },
  {
    key: 'treasure-an', zone: 'treasure', title: 'İlk kıyı sandığı', target: 'an', tokens: ['a', 'n'],
    options: ['an', 'en', 'at'], emoji: '🏝️',
    intro: 'Sahilde bir sandık bulduk! an sesini dinleyip doğru taşları seç. a ve n şifresiyle sandığı aç.',
    success: 'İlk sandık açıldı! Hazinendeki deniz yıldızını adana yerleştirebilirsin.',
    reward: { emoji: '⭐', label: 'Deniz yıldızı' },
  },
  {
    key: 'treasure-el', zone: 'treasure', title: 'Renkli bahçe sandığı', target: 'el', tokens: ['e', 'l'],
    options: ['el', 'al', 'et'], emoji: '🏝️',
    intro: 'Bahçenin yanında renkli bir sandık var. el sesini dinleyerek taşlardan geç, e ve l şifresini kur.',
    success: 'Bahçe sandığı açıldı! Hazinendeki çiçeği adanda bir yere dikebilirsin.',
    reward: { emoji: '🌻', label: 'Güneş çiçeği' },
  },
  {
    key: 'treasure-at', zone: 'treasure', title: 'Çiftlik yolu sandığı', target: 'at', tokens: ['a', 't'],
    options: ['at', 'et', 'an'], emoji: '🏝️',
    intro: 'Çiftlik yolunda bir sandık bulduk. at sesini dinleyerek ilerle, a ve t kartlarıyla şifreyi tamamla.',
    success: 'Çiftlik sandığı açıldı! Yeni ağacını adana yerleştirebilirsin.',
    reward: { emoji: '🌳', label: 'Gölgelik ağaç' },
  },
  {
    key: 'treasure-in', zone: 'treasure', title: 'Ay ışığı sandığı', target: 'in', tokens: ['i', 'n'],
    options: ['in', 'an', 'en'], emoji: '🏝️',
    intro: 'Ay ışığında bir sandık parlıyor. in sesini bul, taşları geç ve i ile n şifresini kur.',
    success: 'Ay ışığı sandığı açıldı! Hazinendeki ay süsünü adana koyabilirsin.',
    reward: { emoji: '🌙', label: 'Ay ışığı süsü' },
  },
  {
    key: 'treasure-ne', zone: 'treasure', title: 'Gökkuşağı sandığı', target: 'ne', tokens: ['n', 'e'],
    options: ['ne', 'na', 'ni'], emoji: '🏝️',
    intro: 'Gökkuşağının yanında bir sandık var. ne sesini dinleyerek taşları seç ve n ile e şifresini tamamla.',
    success: 'Gökkuşağı sandığı açıldı! Renkli hazineni adana yerleştirebilirsin.',
    reward: { emoji: '🌈', label: 'Gökkuşağı süsü' },
  },
  {
    key: 'treasure-ari', zone: 'treasure', title: 'Arının gizli sandığı', target: 'arı', tokens: ['a', 'r', 'ı'],
    options: ['arı', 'ayı', 'at'], emoji: '🏝️',
    intro: 'Arı gizli sandığını gösteriyor. arı sözcüğünü dinleyip taşlardan geç ve a, r, ı şifresini kur.',
    success: 'Arının sandığı açıldı! Küçük çiçekli hazineni adana yerleştirebilirsin.',
    reward: { emoji: '🌼', label: 'Arının çiçeği' },
  },
];

function letterOf(value) {
  if (typeof value !== 'string') return '';
  const letter = value.normalize('NFC').toLocaleLowerCase('tr-TR').trim();
  return ALPHABET.includes(letter) ? letter : '';
}

function knownLetters(letters) {
  const input = Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : [];
  const selected = new Set(input.map(letterOf).filter(Boolean));
  return ALPHABET.filter(letter => selected.has(letter));
}

function fallback(zone, letter) {
  const scenes = {
    care: { title: 'Minik dosta bir paket', emoji: '🐢', intro: `Minik dostun paketini bekliyor. ${letter} yazan paketi bul ve önündeki kaba bırak.`, success: 'Paketi dostuna ulaştırdın! Koyundaki küçük dostun sevindi.', reward: { emoji: '🐢', label: `${letter} paketinin dostu` } },
    train: { title: 'İlk vagon yolculuğu', emoji: '🚂', intro: `Tren ilk kartını taşıyacak. ${letter} vagonunu bağla ve treni istasyona gönder.`, success: 'Vagon istasyona ulaştı! Küçük tren durağın hazır.', reward: { emoji: '🚂', label: `${letter} vagonunun durağı` } },
    treasure: { title: 'Küçük harf sandığı', emoji: '🏝️', intro: `Bir harf sandığı bulduk. ${letter} sesini dinle, doğru taşı seç ve aynı kartla sandığı aç.`, success: 'Küçük sandık açıldı! Hazineni adana yerleştirebilirsin.', reward: { emoji: '🌱', label: `${letter} sandığının filizi` } },
  };
  return { ...scenes[zone], key: `${zone}-letter-${letter}`, zone, target: letter, tokens: [letter], options: [letter] };
}

const BY_KEY = new Map(AUTHORED.map(mission => [mission.key, mission]));
for (const zone of ISLAND_ZONES) for (const letter of ALPHABET) {
  const mission = fallback(zone.id, letter);
  BY_KEY.set(mission.key, mission);
}

function completionDetails(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(':');
  if (parts[0] !== 'island' || parts.length < 2 || parts.length > 3) return null;
  const mission = BY_KEY.get(parts[1]);
  if (!mission) return null;
  const choice = parts[2];
  const placement = mission.zone === 'treasure' && PLACEMENTS.includes(choice) ? choice : undefined;
  const companion = mission.zone === 'care' && Object.hasOwn(ISLAND_COMPANIONS, choice) ? choice : undefined;
  if (parts.length === 3 && !placement && !companion) return null;
  return { key: `island:${mission.key}`, mission, placement, companion };
}

export function normalizeIslandCompletion(value) {
  return completionDetails(value)?.key || null;
}

export function isIslandCompletion(value) {
  return completionDetails(value) !== null;
}

export function getIslandMission(zone, letters, completed = []) {
  if (!ISLAND_ZONES.some(item => item.id === zone)) return null;
  const known = knownLetters(letters);
  if (!known.length) return null;
  const allowed = text => [...text].every(letter => known.includes(letter));
  const authored = AUTHORED.filter(mission => mission.zone === zone && allowed(mission.target));
  const eligible = authored.length ? authored : known.map(letter => fallback(zone, letter));
  const history = Array.isArray(completed) ? completed : [];
  const last = [...history].reverse().map(completionDetails)
    .find(item => item && eligible.some(mission => `island:${mission.key}` === item.key));
  const previous = last ? eligible.findIndex(mission => `island:${mission.key}` === last.key) : -1;
  const index = (previous + 1) % eligible.length;
  const mission = eligible[index];
  const options = [...new Set([mission.target, ...mission.options, ...known])].filter(allowed).slice(0, 3);
  // Do not put the correct parcel/stone in the same position in every scene.
  const offset = [...mission.key].reduce((sum, letter) => sum + letter.codePointAt(0), 0) % options.length;
  return {
    ...mission, kind: zone, tokens: [...mission.tokens], reward: { ...mission.reward },
    options: [...options.slice(offset), ...options.slice(0, offset)],
    level: index + 1, total: eligible.length,
  };
}

export function deriveIslandWorld(completed = []) {
  const unique = new Map();
  for (const value of Array.isArray(completed) ? completed : []) {
    const item = completionDetails(value);
    if (!item) continue;
    // A replay preserves one reward per mission while keeping the child's
    // latest companion or treasure placement.
    unique.delete(item.key);
    unique.set(item.key, item);
  }
  const rewards = [...unique.values()].map(({ key, mission, placement, companion }) => ({
    key, zone: mission.zone, ...mission.reward, ...(placement ? { placement } : {}),
    ...(companion ? {
      companion, emoji: ISLAND_COMPANIONS[companion].emoji, label: ISLAND_COMPANIONS[companion].name,
    } : {}),
  }));
  return {
    care: rewards.filter(reward => reward.zone === 'care').length,
    train: rewards.filter(reward => reward.zone === 'train').length,
    treasure: rewards.filter(reward => reward.zone === 'treasure').length,
    total: rewards.length, completedKeys: [...unique.keys()], rewards,
  };
}
