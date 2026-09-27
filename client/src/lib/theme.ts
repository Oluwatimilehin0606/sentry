export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'sentry-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage can be blocked; fall back to the OS setting.
  }
  return 'system';
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Not critical: the choice just won't be remembered.
  }
}

/** Keeps "system" in sync when the OS switches between light and dark. */
export function watchSystemTheme() {
  media.addEventListener('change', () => {
    if (getThemeChoice() === 'system') applyTheme('system');
  });
}
