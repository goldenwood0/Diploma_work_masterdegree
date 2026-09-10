import { useEffect, useState } from 'react';
import { resolveRoute, routes, type Screen } from './routes';

// Hash URLs work both inside Figma preview and on static hosting without rewrites.
export default function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const update = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  function navigate(next: Screen, slug?: string) {
    window.location.hash = next === 'lesson' && slug ? `/lessons/${encodeURIComponent(slug)}` : routes[next];
  }

  const slug = hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '').split('/')[2] ?? 'hsk1-greetings';
  return [resolveRoute(hash), navigate, slug] as const;
}
