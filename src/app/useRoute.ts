import { useEffect, useState } from 'react';
import { resolveRoute, routes, type Screen } from './routes';

// Hash URLs work both inside Figma preview and on static hosting without rewrites.
export default function useRoute() {
  const [screen, setScreen] = useState(() => resolveRoute(window.location.hash));

  useEffect(() => {
    const update = () => {
      setScreen(resolveRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  function navigate(next: Screen) {
    window.location.hash = routes[next];
  }

  return [screen, navigate] as const;
}
