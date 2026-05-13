import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useTheme() {
  const { theme, setTheme } = useSettingsStore();

  const applyTheme = (themeValue: 'dark' | 'light' | 'system') => {
    let activeTheme = themeValue;
    if (themeValue === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', activeTheme);
  };

  const initTheme = () => {
    const saved = localStorage.getItem('nex-theme') as 'dark' | 'light' | 'system' | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme(theme);
    }
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('nex-theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (useSettingsStore.getState().theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return { theme, setTheme, initTheme };
}
