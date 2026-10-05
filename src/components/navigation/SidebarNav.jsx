import React from 'react';
import { followRouteLink, routePaths } from '../../routing.js';

const items = [
  { label: 'Overview', view: 'Overview', path: routePaths.Overview, icon: '▣' },
  { label: 'Start a session', view: 'Start Session', path: routePaths['Start Session'], icon: '+' },
  { label: 'Session History', view: 'Sessions', path: routePaths.Sessions, icon: '◷' },
  { label: 'Projects', view: 'Projects', path: routePaths.Projects, icon: '□' },
  { label: 'Analytics', view: 'Analytics', path: routePaths.Analytics, icon: '▥' },
];

export default function SidebarNav({ pathname, onNavigate }) {
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {items.map(({ label, view, path, icon }) => {
        const active = pathname === path || (view === 'Sessions' && pathname.startsWith(`${path}/`));
        return <a key={view} href={path} className={`sidebar-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={(event) => followRouteLink(event, onNavigate)}>
          <span className="sidebar-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </a>;
      })}
    </nav>
  );
}
