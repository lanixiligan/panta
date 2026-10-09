export const routePaths = {
  Overview: '/',
  'Session Workspace': '/session-workspace',
  'Session History': '/session-history',
  Projects: '/projects',
  Analytics: '/analytics',
  Settings: '/settings',
};

export function sessionDetailPath(sessionId) {
  return `/session-history/${encodeURIComponent(sessionId)}`;
}

export function projectDetailPath(fullName) {
  const [owner = '', repo = ''] = fullName.split('/');
  return `/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

// Page state that belongs in the URL (filters, ranges, toggles). A value of null or the page's default removes the key.
export function readSearchParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function updateSearchParams(updates) {
  const params = new URLSearchParams(window.location.search);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  });
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
  if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', url);
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
  if (normalizedPath === '/settings') return { view: 'Settings' };
  return { view: 'Not Found' };
}
