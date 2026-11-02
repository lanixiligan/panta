import React from 'react';
import { followRouteLink, routePaths } from '../../routing.js';

// The empty pages' way into the Session Workspace.
export default function StartSessionLink({ onNavigate }) {
  return <a className="subtle-action" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, onNavigate)}>Start a session <span aria-hidden="true">→</span></a>;
}
