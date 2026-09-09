export const routes = {
  dashboard: '/',
  catalog: '/courses',
  lesson: '/lessons/hsk1-greetings',
  profile: '/profile',
  reviews: '/reviews',
} as const;

export type Screen = keyof typeof routes;

export function resolveRoute(hash: string): Screen | 'not-found' {
  const path = (hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/';
  return (Object.keys(routes) as Screen[]).find(screen => routes[screen] === path) ?? 'not-found';
}
