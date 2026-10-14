import React from 'react';
import { languageColors } from './languageColors.js';

// A repository's language with its GitHub color dot. Languages Linguist doesn't color keep the default dot.
export default function RepositoryLanguage({ language, className }) {
  const color = language ? languageColors[language] : null;
  return (
    <span className={`repository-language${language ? '' : ' is-none'}${className ? ` ${className}` : ''}`}>
      <i aria-hidden="true" style={color ? { '--language-color': color } : undefined} />
      {language || 'No language'}
    </span>
  );
}
