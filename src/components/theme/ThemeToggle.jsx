import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

// Light, dark, or the system's setting: three radio buttons drawn as one segmented control, so arrow keys move
// between them and screen readers announce the group.
export default function ThemeToggle({ value, onChange, size = 'sm' }) {
  return (
    <fieldset className={`theme-toggle${size === 'lg' ? ' is-large' : ''}`}>
      <legend className="visually-hidden">Theme</legend>
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <label key={option} className="theme-toggle-option" title={label}>
          <input type="radio" name="theme" value={option} checked={value === option} onChange={() => onChange(option)} />
          <Icon size={size === 'lg' ? 16 : 15} strokeWidth={1.6} aria-hidden="true" />
          <span className="visually-hidden">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
