// Fixed original dialogue. These stable IDs also name the recorded voice clips.
export const FILM_TITLE = 'Minik Aslan ve Suskun Değirmen';
export const FILM_LINES = [
  { id: 's1-morning', scene: 0, speaker: 'narrator', text: 'Harf Adası’nda yeni bir gün başladı. Minik Aslan ile Pırpır, bahçeye bir çiçek soğanı götürüyordu.', cue: 'arrival' },
  { id: 's1-promise', scene: 0, speaker: 'lion', text: 'Bu küçücük soğandan bir lale büyüyecek. Ona güzel bir yer seçelim.' },
  { id: 's1-garden', scene: 0, speaker: 'bird', text: 'Soldaki bahçe mi, sağdaki bahçe mi? Hangisini seçersen oraya gideceğiz.' },
  { id: 's2-wind', scene: 1, speaker: 'narrator', text: 'Tam o sırada rüzgâr çıktı. Kuru yapraklar su kanalına doldu. Çark yavaşladı ve durdu.', cue: 'wind' },
  { id: 's2-empty-revised', scene: 1, speaker: 'bird', text: 'Bir damla... Bir damla daha... Hay aksi! Bahçeye su gelmiyor!' },
  { id: 's2-plan', scene: 1, speaker: 'lion', text: 'Suyun yolunu izleyelim. Pırpır yukarıdan uçabilir. Ben de kıyıdan yürüyebilirim.' },
  { id: 's3-bird', scene: 2, speaker: 'bird', text: 'Yukarıdan bakınca gördüm! Yapraklar küçük kapağın arkasında birikmiş.', cue: 'inspect-bird' },
  { id: 's3-lion', scene: 2, speaker: 'lion', text: 'Kıyıdaki izi takip ettim. Su, küçük kapağın arkasında birikmiş.', cue: 'inspect-lion' },
  { id: 's3-label', scene: 2, speaker: 'lion', text: 'Kapağı açmadan önce çiçeğimizin etiketini hazırlayalım. Heceleri birlikte okuyalım: la, le. Lale.' },
  { id: 's3-guided', scene: 2, speaker: 'bird', text: 'Örneğe bakabilirsin. Önce la, sonra le. İki parçayı ahşap etikete yerleştir.' },
  { id: 's3-help', scene: 2, speaker: 'lion', text: 'Birlikte bakalım. La başta, le sonda. Birleşince lale oluyor.' },
  { id: 's3-retry', scene: 2, speaker: 'bird', text: 'Parçaların sırası değişmiş. Örneğe yeniden bakalım.' },
  { id: 's4-open', scene: 3, speaker: 'lion', text: 'Etiketimiz hazır. Şimdi kapağı açıyorum. Haydi, yaprakları sepete toplayalım.', cue: 'open-gate' },
  { id: 's4-leaves', scene: 3, speaker: 'bird', text: 'Ben tek başıma çekemedim. Her yaprağa dokun. Sepetimiz hepsini taşıyabilir.' },
  { id: 's4-clear', scene: 3, speaker: 'narrator', text: 'Son yaprak da sepete girdi. Suyun önü açıldı.', cue: 'clear-leaves' },
  { id: 's4-cause', scene: 3, speaker: 'lion', text: 'Birlikte düşünelim. Su çarkı neden durmuştu?' },
  { id: 's4-cause-help', scene: 3, speaker: 'bird', text: 'Rüzgâr yaprakları kanala taşımıştı. Yapraklar suyun yolunu kapattı.' },
  { id: 's4-cause-retry', scene: 3, speaker: 'lion', text: 'Rüzgâr çıkınca kanala ne dolmuştu? O anı düşünelim.' },
  { id: 's5-wheel', scene: 4, speaker: 'narrator', text: 'Su yeniden aktı. Çark döndü. Bahçeye giden küçük kanal dolmaya başladı.', cue: 'wheel-start' },
  { id: 's5-recall', scene: 4, speaker: 'bird', text: 'Etiketimiz çantada kaldı. Çiçeğimizin adını hatırlıyor musun? Harflerini sırayla yerleştir.' },
  { id: 's5-recall-help', scene: 4, speaker: 'lion', text: 'Çiçeğimizin adı lale. La ve le hecelerinden oluşuyor. Şimdi birlikte kurabiliriz.' },
  { id: 's5-recall-retry', scene: 4, speaker: 'bird', text: 'Henüz tamamlanmadı. Harflerin sırasına bir daha bakalım.' },
  { id: 's5-write', scene: 4, speaker: 'lion', text: 'Şimdi aynı kelimeyi aşağıya kendin yaz. Bitirince bir büyüğünle birlikte kontrol et.' },
  { id: 's5-write-help', scene: 4, speaker: 'lion', text: 'Örneğimiz lale. Harflere bakıp yazabilirsin. Bu kez yardım alarak çalışıyoruz.' },
  { id: 's5-read', scene: 4, speaker: 'narrator', text: 'Kısa bir cümleyi bir büyüğünle birlikte okuyalım: Lale al.' },
  { id: 's5-water', scene: 4, speaker: 'lion', text: 'Etiket yerini buldu. Şimdi suyu seçtiğimiz bahçeye gönderelim.', cue: 'water-garden' },
  { id: 's6-days', scene: 5, speaker: 'narrator', text: 'Günler geçti. Minik Aslan ile Pırpır çiçeklerini suladı. Bir sabah, küçük bir tomurcuk açıldı.', cue: 'flower-grow' },
  { id: 's6-ribbon', scene: 5, speaker: 'bird', text: 'İşte bizim lalemiz! Bahçemiz için bir kurdele rengi seçelim.' },
  { id: 's6-together', scene: 5, speaker: 'lion', text: 'Suyun yolunu birlikte açtık. Küçük çiçeğimiz de yerini buldu.' },
  { id: 's6-goodbye', scene: 5, speaker: 'bird', text: 'Bir sonraki ada macerasında görüşürüz!', cue: 'wave' },
];

export const FILM_SCENES = [
  { id: 'garden', title: 'Bahçeye bir söz', lines: ['s1-morning', 's1-promise', 's1-garden'] },
  { id: 'wind', title: 'Çark neden sustu?', lines: ['s2-wind', 's2-empty-revised', 's2-plan'] },
  { id: 'investigate', title: 'İzin peşinde', lines: ['s3-bird', 's3-lion', 's3-label', 's3-guided'] },
  { id: 'channel', title: 'Yaprakların sırrı', lines: ['s4-open', 's4-leaves'] },
  { id: 'water', title: 'Su yeniden yolda', lines: ['s5-wheel', 's5-recall'] },
  { id: 'flower', title: 'Bahçenin cevabı', lines: ['s6-days', 's6-ribbon', 's6-together', 's6-goodbye'] },
];

export const FILM_LINE_BY_ID = Object.freeze(Object.fromEntries(FILM_LINES.map(line => [line.id, line])));
