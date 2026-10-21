// Light or dark: the viewer picks one, or follows the system. The inline script in index.html applies the saved choice
// before the first paint with the same rules, so keep the two in step.
export const THEME_KEY = 'panta.theme';
export const THEME_CHOICES = ['light', 'dark', 'system'];
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function normalizeThemeChoice(value) {
  return THEME_CHOICES.includes(value) ? value : 'system';
}

// The theme a choice shows: dark unless light is chosen, or the system asks for light.
export function resolveTheme(choice, systemPrefersLight) {
  if (choice === 'light' || choice === 'dark') return choice;
  return systemPrefersLight ? 'light' : 'dark';
}

// Storage can be unavailable (private windows, blocked site data), so reading falls back to the system.
export function readThemeChoice() {
  try {
    return normalizeThemeChoice(window.localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function saveThemeChoice(choice) {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The choice still applies for this visit.
  }
}

export function systemPrefersLight() {
  return window.matchMedia(LIGHT_QUERY).matches;
}

// Calls back whenever the system switches between light and dark. Returns the unsubscribe function.
export function watchSystemTheme(onChange) {
  const query = window.matchMedia(LIGHT_QUERY);
  const listener = (event) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

// Sets data-theme on <html>, and matches the browser chrome (theme-color) to the page background.
export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const background = getComputedStyle(root).getPropertyValue('--workspace-bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}
