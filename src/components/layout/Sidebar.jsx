import React from 'react';
import AuthControl from '../auth/AuthControl.jsx';
import ActiveSessionIndicator from '../sessions/ActiveSessionIndicator.jsx';
import SidebarNav from '../navigation/SidebarNav.jsx';
import UserProfileMenu from '../profile/UserProfileMenu.jsx';

export default function Sidebar({ identity, identityStatus, view, onNavigate, activeSession, now, onLogout }) {
  return (
    <aside className="workspace-sidebar">
      <a className="app-brand sidebar-brand" href="#overview" onClick={(event) => { event.preventDefault(); onNavigate('Overview'); }} aria-label="Panta overview">
        <span className="brand-symbol" aria-hidden="true">P</span><span><strong>Panta</strong><small>Your work, over time.</small></span>
      </a>
      <SidebarNav activeView={view === 'Session Detail' ? 'Sessions' : view} onNavigate={onNavigate} />
      <ActiveSessionIndicator session={activeSession} now={now} onClick={() => onNavigate('Sessions')} />
      <div className="sidebar-bottom">
        {identityStatus === 'authenticated' && identity ? (
          <UserProfileMenu identity={identity} onNavigate={onNavigate} onLogout={onLogout} />
        ) : (
          <div className="sidebar-auth"><AuthControl /></div>
        )}
      </div>
    </aside>
  );
}
