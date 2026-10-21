import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { followRouteLink } from '../../routing.js';

// The link from a page back to the page it belongs under. `label` names that page ("Session History", a repository).
export default function BackLink({ href, label, onNavigate }) {
  return (
    <a className="back-link" href={href} onClick={(event) => followRouteLink(event, onNavigate)}>
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
