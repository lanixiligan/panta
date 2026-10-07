export const routePaths = {
  Overview: '/',
  'Session Workspace': '/session-workspace',
  'Session History': '/session-history',
  Projects: '/projects',
  Analytics: '/analytics',
  Profile: '/profile',
  Settings: '/settings',
};

export function sessionDetailPath(sessionId) {
  return `/session-history/${encodeURIComponent(sessionId)}`;
}

export function projectDetailPath(fullName) {
  const [owner = '', repo = ''] = fullName.split('/');
  return `/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function followRouteLink(event, navigate) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.pathname);
}

export function resolveRoute(pathname) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  if (normalizedPath === '/') return { view: 'Overview' };
  if (normalizedPath === '/session-workspace') return { view: 'Session Workspace' };
  if (normalizedPath === '/session-history') return { view: 'Session History' };
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
  if (normalizedPath.startsWith('/projects/')) {
    const segments = normalizedPath.slice('/projects/'.length).split('/');
    if (segments.length === 2 && segments.every(Boolean)) {
      try {
        return { view: 'Project Detail', owner: decodeURIComponent(segments[0]), repo: decodeURIComponent(segments[1]) };
      } catch {
        return { view: 'Not Found' };
      }
    }
  }
  if (normalizedPath === '/analytics') return { view: 'Analytics' };
  if (normalizedPath === '/profile') return { view: 'Profile' };
  if (normalizedPath === '/settings') return { view: 'Settings' };
  return { view: 'Not Found' };
}
