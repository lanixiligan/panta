export const routePaths = {
  Overview: '/',
  'Start Session': '/start-session',
  Sessions: '/session-history',
  Projects: '/projects',
  Analytics: '/analytics',
  Profile: '/profile',
  Settings: '/settings',
};

export function sessionDetailPath(sessionId) {
  return `/session-history/${encodeURIComponent(sessionId)}`;
}

export function followRouteLink(event, navigate) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.pathname);
}

export function resolveRoute(pathname) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  if (normalizedPath === '/') return { view: 'Overview' };
  if (normalizedPath === '/start-session') return { view: 'Start Session' };
  if (normalizedPath === '/session-history') return { view: 'Sessions' };
  if (normalizedPath.startsWith('/session-history/')) {
    const segment = normalizedPath.slice('/session-history/'.length);
    if (segment && !segment.includes('/')) {
      try {
        return { view: 'Session Detail', sessionId: decodeURIComponent(segment) };
      } catch {
        return { view: 'Not Found' };
      }
    }
  }
  if (normalizedPath === '/projects') return { view: 'Projects' };
  if (normalizedPath === '/analytics') return { view: 'Analytics' };
  if (normalizedPath === '/profile') return { view: 'Profile' };
  if (normalizedPath === '/settings') return { view: 'Settings' };
  return { view: 'Not Found' };
}
