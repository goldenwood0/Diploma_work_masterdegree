export const routes = {
  dashboard: '/',
  catalog: '/courses',
  lesson: '/lessons/hsk1-greetings',
  profile: '/profile',
  reviews: '/reviews',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  resendVerification: '/resend-verification',
} as const;

export type Screen = keyof typeof routes;

export function resolveRoute(hash: string): Screen | 'not-found' {
  const path = (hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/';
  if (/^\/lessons\/[a-z0-9-]+$/.test(path)) return 'lesson';
  return (Object.keys(routes) as Screen[]).find(screen => routes[screen] === path) ?? 'not-found';
}
