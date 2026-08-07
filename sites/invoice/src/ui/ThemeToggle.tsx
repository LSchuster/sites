import { useState } from 'react';
import { t } from '../i18n';
import type { Theme } from '../theme';
import { setTheme, storedTheme } from '../theme';

const ORDER: Theme[] = ['system', 'dark', 'light'];

export function ThemeToggle() {
  const [theme, setState] = useState<Theme>(storedTheme());

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
    setTheme(next);
    setState(next);
  }

  const label =
    theme === 'system' ? t.themeSystem : theme === 'dark' ? t.themeDark : t.themeLight;
  const icon = theme === 'system' ? '◐' : theme === 'dark' ? '●' : '○';

  return (
    <button type="button" className="ghost theme-toggle" onClick={cycle} title={t.themeTitle}>
      <span aria-hidden="true">{icon}</span> {label}
    </button>
  );
}
