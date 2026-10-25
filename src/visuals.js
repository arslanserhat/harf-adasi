const illustrations = Object.freeze({
  "🎮": "video_game_3d.png",
  "⭐": "star_3d.png",
  "🔊": "speaker_high_volume_3d.png",
  "⚙️": "gear_3d.png",
  "🦁": "lion_3d.png",
  "👩": "woman_3d_default.png",
  "👵": "old_woman_3d_default.png",
  "🌿": "herb_3d.png",
  "🌷": "tulip_3d.png",
  "✋": "raised_hand_3d_default.png",
  "🐎": "horse_3d.png",
  "🥩": "cut_of_meat_3d.png",
  "🏫": "school_3d.png",
  "✏️": "pencil_3d.png",
  "📖": "open_book_3d.png",
  "🍎": "red_apple_3d.png",
  "🍐": "pear_3d.png",
  "🍌": "banana_3d.png",
  "🍋": "lemon_3d.png",
  "🍒": "cherries_3d.png",
  "🍓": "strawberry_3d.png",
  "🍇": "grapes_3d.png",
  "🍈": "melon_3d.png",
  "🍉": "watermelon_3d.png",
  "🐟": "fish_3d.png",
  "🐈": "cat_3d.png",
  "🐕": "dog_3d.png",
  "🐦": "bird_3d.png",
  "🐝": "honeybee_3d.png",
  "🐄": "cow_3d.png",
  "🐑": "ewe_3d.png",
  "🐐": "goat_3d.png",
  "🐔": "chicken_3d.png",
  "🦆": "duck_3d.png",
  "🐯": "tiger_face_3d.png",
  "🐘": "elephant_3d.png",
  "🦓": "zebra_3d.png",
  "🐭": "mouse_face_3d.png",
  "🐻": "bear_3d.png",
  "🐸": "frog_3d.png",
  "🦊": "fox_3d.png",
  "🦒": "giraffe_3d.png",
  "🌳": "deciduous_tree_3d.png",
  "⛰️": "mountain_3d.png",
  "🌧️": "cloud_with_rain_3d.png",
  "☀️": "sun_3d.png",
  "🌙": "crescent_moon_3d.png",
  "☁️": "cloud_3d.png",
  "❄️": "snowflake_3d.png",
  "🌼": "blossom_3d.png",
  "🍃": "leaf_fluttering_in_wind_3d.png",
  "👁️": "eye_3d.png",
  "👂": "ear_3d_default.png",
  "👃": "nose_3d_default.png",
  "👄": "mouth_3d.png",
  "🦷": "tooth_3d.png",
  "🦶": "foot_3d_default.png",
  "🏠": "house_3d.png",
  "🚪": "door_3d.png",
  "🪑": "chair_3d.png",
  "💡": "light_bulb_3d.png",
  "⏰": "alarm_clock_3d.png",
  "👒": "womans_hat_3d.png",
  "🎒": "backpack_3d.png",
  "🧦": "socks_3d.png",
  "☂️": "umbrella_3d.png",
  "🚲": "bicycle_3d.png",
  "🚗": "automobile_3d.png",
  "🚂": "locomotive_3d.png",
  "🚢": "ship_3d.png",
  "✈️": "airplane_3d.png",
  "🛩️": "small_airplane_3d.png",
  "⚽": "soccer_ball_3d.png",
  "🎈": "balloon_3d.png",
  "🍞": "bread_3d.png",
  "🥛": "glass_of_milk_3d.png",
  "💧": "droplet_3d.png",
  "🧀": "cheese_wedge_3d.png",
  "🥚": "egg_3d.png",
  "🫑": "bell_pepper_3d.png",
  "🥕": "carrot_3d.png",
  "✍️": "writing_hand_3d_default.png",
  "💭": "thought_balloon_3d.png",
  "🌱": "seedling_3d.png",
  "🌈": "rainbow_3d.png",
  "🦋": "butterfly_3d.png",
  "🌻": "sunflower_3d.png",
  "🐢": "turtle_3d.png",
  "🐬": "dolphin_3d.png",
  "🦉": "owl_3d.png",
  "🐞": "lady_beetle_3d.png",
  "🏝️": "desert_island_3d.png",
  "👑": "crown_3d.png",
  "🧩": "puzzle_piece_3d.png",
  "🔇": "muted_speaker_3d.png",
  "▶": "play_button_3d.png",
  "🎁": "wrapped_gift_3d.png",
  "🧽": "sponge_3d.png",
  "🟢": "green_circle_3d.png",
  "🎉": "party_popper_3d.png",
  "🏆": "trophy_3d.png",
  "🎯": "bullseye_3d.png",
  "✨": "sparkles_3d.png",
  "❤️": "red_heart_3d.png",
  "🖌️": "paintbrush_3d.png",
  "🎨": "artist_palette_3d.png",
  "📚": "books_3d.png",
  "🧠": "brain_3d.png",
  "⏸️": "pause_button_3d.png",
  "✅": "check_mark_button_3d.png",
  "🔈": "speaker_low_volume_3d.png",
  "💛": "yellow_heart_3d.png"
});

const baseUrl = typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || './');
const escaped = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const canonical = value => value.replace(/\uFE0F/g, '');
const byCanonical = new Map(Object.entries(illustrations).map(([emoji, filename]) => [canonical(emoji), filename]));
const keys = [...byCanonical.keys()].sort((a, b) => b.length - a.length);
const pattern = new RegExp(keys.map(key => [...key].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\uFE0F?').join('')).join('|'), 'gu');
const skip = 'script,style,textarea,input,svg,canvas,code,pre,[contenteditable="true"],[data-no-illustration]';

function imageNode(filename, alt = '', className = '') {
  const image = document.createElement('img');
  image.src = `${baseUrl}illustrations/${filename}`;
  image.alt = alt;
  image.className = `illustration${className ? ` ${className}` : ''}`;
  image.width = 160;
  image.height = 160;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.style.pointerEvents = 'none';
  if (!alt) image.setAttribute('aria-hidden', 'true');
  return image;
}

export function illustration(emoji, alt = '', className = '') {
  const filename = byCanonical.get(canonical(emoji));
  if (!filename) return escaped(emoji);
  return `<img class="illustration${className ? ` ${escaped(className)}` : ''}" src="${escaped(baseUrl)}illustrations/${escaped(filename)}" alt="${escaped(alt)}"${alt ? '' : ' aria-hidden="true"'} width="160" height="160" loading="lazy" decoding="async" draggable="false" style="pointer-events:none">`;
}

export function decorateIllustrations(root = document) {
  if (!root || root.nodeType === Node.ELEMENT_NODE && root.matches(skip)) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement || node.parentElement.closest(skip)) return NodeFilter.FILTER_REJECT;
      pattern.lastIndex = 0;
      return pattern.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let replaced = 0;
  for (const node of nodes) {
    const value = node.nodeValue || '';
    const fragment = document.createDocumentFragment();
    pattern.lastIndex = 0;
    let position = 0;
    for (const match of value.matchAll(pattern)) {
      const filename = byCanonical.get(canonical(match[0]));
      if (!filename) continue;
      if (match.index > position) fragment.append(document.createTextNode(value.slice(position, match.index)));
      fragment.append(imageNode(filename));
      position = match.index + match[0].length;
      replaced++;
    }
    if (position) {
      if (position < value.length) fragment.append(document.createTextNode(value.slice(position)));
      node.replaceWith(fragment);
    }
  }
  return replaced;
}

export function mountVisuals(root = document) {
  decorateIllustrations(root);
  let frame = 0;
  let disposed = false;
  const observer = new MutationObserver(records => {
    if (disposed || frame) return;
    const relevant = records.some(record => record.type === 'characterData' || [...record.addedNodes].some(node => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE && !node.matches('img.illustration')));
    if (!relevant) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) decorateIllustrations(root);
    });
  });
  observer.observe(root === document ? document.documentElement : root, {childList:true, characterData:true, subtree:true});
  return () => { disposed = true; observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
}
