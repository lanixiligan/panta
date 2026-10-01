import React from 'react';
import Sidebar from './Sidebar.jsx';

export default function AppShell({ children, ...sidebarProps }) {
  return (
    <div className="app-shell app-shell-dark workspace-shell">
      <Sidebar {...sidebarProps} />
      <div className="workspace-main">
        <main className="app-main" id="main-content">{children}</main>
        <footer className="app-footer"><span>PANTA</span><span>Your work, over time.</span></footer>
      </div>
    </div>
  );
}
