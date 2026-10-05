import React from 'react';
import AuthControl from '../auth/AuthControl.jsx';
import ActiveSessionIndicator from '../sessions/ActiveSessionIndicator.jsx';
import SidebarNav from '../navigation/SidebarNav.jsx';
import UserProfileMenu from '../profile/UserProfileMenu.jsx';
import { followRouteLink, routePaths } from '../../routing.js';

export default function Sidebar({ identity, identityStatus, view, pathname, onNavigate, activeSession, now, onLogout }) {
  return (
    <aside className="workspace-sidebar">
      <a className="app-brand sidebar-brand" href={routePaths.Overview} onClick={(event) => followRouteLink(event, onNavigate)} aria-label="Panta overview">
        <span className="brand-symbol" aria-hidden="true">P</span><span><strong>Panta</strong><small>Your work, over time.</small></span>
      </a>
      <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      <ActiveSessionIndicator session={activeSession} now={now} onClick={() => onNavigate(routePaths['Start Session'])} />
      <div className="sidebar-bottom">
        {identityStatus === 'authenticated' && identity ? (
          <UserProfileMenu identity={identity} view={view} pathname={pathname} onNavigate={onNavigate} onLogout={onLogout} />
        ) : (
          <div className="sidebar-auth"><AuthControl /></div>
        )}
      </div>
    </aside>
  );
}
