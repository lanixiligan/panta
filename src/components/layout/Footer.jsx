import React from 'react';
import packageJson from '../../../package.json';

const SOURCE_URL = 'https://github.com/lanixiligan/panta';

export default function Footer() {
  return (
    <footer className="app-footer">
      <span className="app-footer-meta">
        <span>Panta {packageJson.version}</span>
        <span aria-hidden="true">·</span>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source <span aria-hidden="true">↗</span></a>
        <span aria-hidden="true">·</span>
        <span>MIT License</span>
      </span>
      <span>Your work, over time.</span>
    </footer>
  );
}
