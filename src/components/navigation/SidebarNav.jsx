import React from 'react';

const items = [
  { label: 'Overview', icon: '▣' },
  { label: 'Sessions', icon: '◷' },
  { label: 'Projects', icon: '□' },
];

export default function SidebarNav({ activeView, onNavigate }) {
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {items.map(({ label, icon }) => (
        <button key={label} type="button" className={`sidebar-nav-item${activeView === label ? ' active' : ''}`} aria-current={activeView === label ? 'page' : undefined} onClick={() => onNavigate(label)}>
          <span className="sidebar-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
