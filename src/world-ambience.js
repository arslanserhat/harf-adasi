import './world-ambience.css';

const BASE = document.querySelector('meta[name="harf-backend"]')?.content === 'laravel'
  ? '/' : import.meta.env.BASE_URL;

/** Decorative sprite frames never receive input or produce learning evidence. */
export function mountWorldAmbience(root = document.body) {
  const attach = () => {
    for (const stage of root.querySelectorAll('.home-island-art, .story-scene-stage')) {
      if (stage.querySelector(':scope > .world-pirpir-flight')) continue;
      const flight = document.createElement('span');
      flight.className = 'world-pirpir-flight';
      flight.setAttribute('aria-hidden', 'true');
      const sprite = document.createElement('span');
      sprite.className = 'world-pirpir-sprite';
      sprite.style.backgroundImage = `url("${BASE}art/pirpir-flight.webp")`;
      flight.append(sprite);
      stage.append(flight);
    }
  };
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true, subtree: true });
  attach();
  return () => observer.disconnect();
}
